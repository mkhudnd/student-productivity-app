import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  MetricCard,
  PrimaryButton,
  ScreenIntro,
  SectionHeader,
  SecondaryButton,
} from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { readJson, writeJson } from '../storage/fileStorage';
import { DataMigrationService } from '../utils/dataMigration';
import { loadProgressWorkspace } from '../utils/progressRepository';
import { layout, radius, spacing, typography } from '../theme/designSystem';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your elementary school?',
  'What is your favorite book?',
  'What was your childhood nickname?',
  'What is the name of your favorite teacher?',
  'What street did you live on in third grade?',
];

function validatePassword(password) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add at least one special character.';
  return null;
}

function displayName(user) {
  return user?.displayName || user?.username || user?.email?.split('@')[0] || 'Student';
}

export default function ProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const {
    currentUser,
    logoutUser,
    updateUser,
    checkUsernameExists,
  } = useUser();
  const styles = getStyles(theme);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usernameModal, setUsernameModal] = useState(false);
  const [username, setUsername] = useState(currentUser?.username || '');
  const [securityModal, setSecurityModal] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState(currentUser?.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [passwordModal, setPasswordModal] = useState(false);
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteAnswer, setDeleteAnswer] = useState('');

  const loadStats = useCallback(async () => {
    if (!currentUser?.email) return;
    try {
      setStats(await loadProgressWorkspace(currentUser, 30));
    } catch (error) {
      console.error('Unable to load profile progress:', error);
      setStats(null);
    }
  }, [currentUser?.email]);

  useFocusEffect(useCallback(() => {
    loadStats();
  }, [loadStats]));

  const getCredentialUser = async () => {
    const users = (await readJson('users.json')) || [];
    return users.find((user) => user.email === currentUser?.email) || null;
  };

  const saveUsername = async () => {
    const value = username.trim();
    if (!value) return Alert.alert('Username required', 'Enter a username.');
    if (value !== currentUser?.username && await checkUsernameExists(value, true)) {
      return Alert.alert('Username unavailable', 'Choose another username.');
    }
    setLoading(true);
    try {
      const result = await updateUser({ username: value });
      if (!result.success) throw new Error(result.error);
      setUsernameModal(false);
    } catch (error) {
      Alert.alert('Could not update username', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveSecurityQuestion = async () => {
    if (securityAnswer.trim().length < 3) {
      return Alert.alert('Answer too short', 'Use at least 3 characters for your security answer.');
    }
    setLoading(true);
    try {
      const result = await updateUser({
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      });
      if (!result.success) throw new Error(result.error);
      setSecurityModal(false);
      setSecurityAnswer('');
    } catch (error) {
      Alert.alert('Could not save recovery question', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPasswordChange = async () => {
    const account = await getCredentialUser();
    if (!account?.securityQuestion || !account?.securityAnswer) {
      Alert.alert(
        'Recovery question required',
        'Set a recovery question before changing your password.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set one now', onPress: () => setSecurityModal(true) },
        ],
      );
      return;
    }
    setVerificationAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModal(true);
  };

  const changePassword = async () => {
    const account = await getCredentialUser();
    if (!account) return Alert.alert('Account unavailable', 'Your local account record could not be found.');
    if (verificationAnswer.trim().toLowerCase() !== String(account.securityAnswer || '').trim().toLowerCase()) {
      return Alert.alert('Verification failed', 'The recovery answer is incorrect.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Passwords do not match', 'Enter the same new password twice.');
    }
    const validationError = validatePassword(newPassword);
    if (validationError) return Alert.alert('Password not strong enough', validationError);

    setLoading(true);
    try {
      const result = await updateUser({
        password: newPassword,
        lastPasswordReset: new Date().toISOString(),
      });
      if (!result.success) throw new Error(result.error);
      setPasswordModal(false);
      setVerificationAnswer('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your local account password has been changed.');
    } catch (error) {
      Alert.alert('Could not change password', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openDelete = async () => {
    const account = await getCredentialUser();
    if (!account?.securityQuestion || !account?.securityAnswer) {
      Alert.alert('Recovery question required', 'Set a recovery question before deleting the account.');
      return;
    }
    setDeleteAnswer('');
    setDeleteModal(true);
  };

  const deleteAccount = async () => {
    const account = await getCredentialUser();
    if (!account) return Alert.alert('Account unavailable', 'Your local account record could not be found.');
    if (deleteAnswer.trim().toLowerCase() !== String(account.securityAnswer || '').trim().toLowerCase()) {
      return Alert.alert('Verification failed', 'The recovery answer is incorrect.');
    }

    Alert.alert(
      'Delete this account?',
      'This permanently removes this local account and its study data from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const email = currentUser.email;
              await Promise.all([
                DataMigrationService.cleanupUserData(email),
                AsyncStorage.removeItem(`planner_data_${email}`),
                AsyncStorage.removeItem(`study_tracker_data_${email}`),
                AsyncStorage.removeItem(`focus_runtime_${email}`),
              ]);
              const users = (await readJson('users.json')) || [];
              await writeJson('users.json', users.filter((user) => user.email !== email));
              await logoutUser();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (error) {
              Alert.alert('Delete failed', 'The account could not be completely removed.');
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const signOut = () => {
    Alert.alert('Sign out?', 'Your study data stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          await logoutUser();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const initial = displayName(currentUser).slice(0, 1).toUpperCase();

  return (
    <>
      <ScreenLayout
        scrollable
        horizontalPadding={false}
        verticalPadding={false}
        contentContainerStyle={styles.content}
        navigation={navigation}
      >
        <ScreenIntro
          eyebrow="Profile"
          title="Your study identity"
          subtitle="Account details and a quick view of your recent progress."
          right={<IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close profile" />}
        />

        {loading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Updating account…</Text>
          </Card>
        ) : null}

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{displayName(currentUser)}</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            <Text style={styles.profileMeta}>Local account on this device</Text>
          </View>
        </Card>

        <SectionHeader title="Last 30 days" subtitle="A compact view of your study momentum." style={styles.sectionSpace} />
        <View style={styles.metricGrid}>
          <MetricCard icon="time-outline" value={stats ? `${stats.totalStudyMinutes}m` : '0m'} label="Study time" />
          <MetricCard icon="flame-outline" value={stats?.streak || 0} label="Day streak" color={theme.colors.warning} />
          <MetricCard icon="checkmark-circle-outline" value={stats?.tasks?.completed || 0} label="Tasks done" color={theme.colors.accent} />
        </View>

        <SectionHeader title="Account" subtitle="Keep identity and recovery settings in one place." style={styles.sectionSpace} />
        <Card style={styles.groupCard}>
          <ProfileRow
            icon="person-outline"
            title="Username"
            subtitle={currentUser?.username || 'Not set'}
            onPress={() => {
              setUsername(currentUser?.username || '');
              setUsernameModal(true);
            }}
            styles={styles}
            theme={theme}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="mail-outline"
            title="Email"
            subtitle={`${currentUser?.email || 'Unknown'} · account identifier`}
            styles={styles}
            theme={theme}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="shield-checkmark-outline"
            title="Recovery question"
            subtitle={currentUser?.securityQuestion || 'Not configured'}
            onPress={() => {
              setSecurityQuestion(currentUser?.securityQuestion || SECURITY_QUESTIONS[0]);
              setSecurityAnswer('');
              setSecurityModal(true);
            }}
            styles={styles}
            theme={theme}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="key-outline"
            title="Password"
            subtitle="Change after recovery verification"
            onPress={openPasswordChange}
            styles={styles}
            theme={theme}
          />
        </Card>

        <SectionHeader title="App" subtitle="Secondary controls stay out of the bottom navigation." style={styles.sectionSpace} />
        <Card style={styles.groupCard}>
          <ProfileRow icon="settings-outline" title="Settings" subtitle="Appearance, reminders and local data" onPress={() => navigation.navigate('Settings')} styles={styles} theme={theme} />
          <View style={styles.divider} />
          <ProfileRow icon="log-out-outline" title="Sign out" subtitle="Keep local data and return to login" onPress={signOut} styles={styles} theme={theme} />
        </Card>

        <SectionHeader title="Danger zone" subtitle="Account deletion is permanent on this device." style={styles.sectionSpace} />
        <Card style={styles.groupCard}>
          <TouchableOpacity style={styles.dangerRow} onPress={openDelete}>
            <AppIcon name="trash-outline" size={21} color={theme.colors.error} />
            <View style={styles.rowCopy}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.rowSubtitle}>Remove this local account and its study data</Text>
            </View>
            <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>
      </ScreenLayout>

      <Modal visible={usernameModal} transparent animationType="fade" onRequestClose={() => !loading && setUsernameModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ModalHeader title="Edit username" subtitle="Choose how your name appears in the app." onClose={() => setUsernameModal(false)} styles={styles} />
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={theme.colors.placeholder} autoCapitalize="none" editable={!loading} />
            <PrimaryButton label="Save username" icon="checkmark" onPress={saveUsername} loading={loading} />
          </View>
        </View>
      </Modal>

      <Modal visible={securityModal} transparent animationType="fade" onRequestClose={() => !loading && setSecurityModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ModalHeader title="Recovery question" subtitle="Used only for this local account's recovery flow." onClose={() => setSecurityModal(false)} styles={styles} />
            <View style={styles.pickerShell}>
              <Picker selectedValue={securityQuestion} onValueChange={setSecurityQuestion} style={styles.picker} dropdownIconColor={theme.colors.textSecondary}>
                {SECURITY_QUESTIONS.map((question) => <Picker.Item key={question} label={question} value={question} />)}
              </Picker>
            </View>
            <TextInput style={styles.input} value={securityAnswer} onChangeText={setSecurityAnswer} placeholder="Your answer" placeholderTextColor={theme.colors.placeholder} editable={!loading} />
            <PrimaryButton label="Save recovery question" icon="shield-checkmark-outline" onPress={saveSecurityQuestion} loading={loading} />
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModal} transparent animationType="fade" onRequestClose={() => !loading && setPasswordModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ModalHeader title="Change password" subtitle={currentUser?.securityQuestion || 'Verify your recovery answer first.'} onClose={() => setPasswordModal(false)} styles={styles} />
            <TextInput style={styles.input} value={verificationAnswer} onChangeText={setVerificationAnswer} placeholder="Recovery answer" placeholderTextColor={theme.colors.placeholder} editable={!loading} />
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={theme.colors.placeholder} secureTextEntry editable={!loading} />
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={theme.colors.placeholder} secureTextEntry editable={!loading} />
            <Text style={styles.passwordHint}>8+ characters with uppercase, lowercase, number and special character.</Text>
            <PrimaryButton label="Change password" icon="key-outline" onPress={changePassword} loading={loading} />
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => !loading && setDeleteModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ModalHeader title="Verify account deletion" subtitle={currentUser?.securityQuestion || 'Enter your recovery answer.'} onClose={() => setDeleteModal(false)} styles={styles} />
            <TextInput style={styles.input} value={deleteAnswer} onChangeText={setDeleteAnswer} placeholder="Recovery answer" placeholderTextColor={theme.colors.placeholder} editable={!loading} />
            <TouchableOpacity style={styles.deleteButton} onPress={deleteAccount} disabled={loading}>
              <AppIcon name="trash-outline" size={19} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Continue to delete account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ProfileRow({ icon, title, subtitle, onPress, styles, theme }) {
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component style={styles.profileRow} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <AppIcon name={icon} size={21} color={theme.colors.primary} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {onPress ? <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} /> : null}
    </Component>
  );
}

function ModalHeader({ title, subtitle, onClose, styles }) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.modalHeaderCopy}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalSubtitle}>{subtitle}</Text>
      </View>
      <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" />
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  profileCard: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.bold,
    fontSize: 24,
    color: theme.colors.primary,
  },
  profileCopy: { flex: 1 },
  profileName: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
  },
  profileEmail: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  profileMeta: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sectionSpace: { marginTop: spacing.xxl },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupCard: {
    padding: 0,
    overflow: 'hidden',
  },
  profileRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dangerRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowCopy: { flex: 1 },
  rowTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  dangerTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.error,
  },
  rowSubtitle: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginLeft: 52,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalHeaderCopy: { flex: 1 },
  modalTitle: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.md,
    backgroundColor: theme.colors.input,
    paddingHorizontal: spacing.md,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: spacing.md,
  },
  pickerShell: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.md,
    backgroundColor: theme.colors.input,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  picker: {
    color: theme.colors.text,
  },
  passwordHint: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  deleteButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: `${theme.colors.error}66`,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  deleteButtonText: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.error,
  },
});
