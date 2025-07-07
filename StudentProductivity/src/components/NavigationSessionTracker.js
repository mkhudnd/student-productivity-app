import { useEffect, useRef } from 'react';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import sessionTracker from '../utils/SessionTracker';

export default function NavigationSessionTracker() {
  const navigation = useNavigation();
  const currentRoute = useRef(null);

  // Track screen changes using navigation state
  const routeName = useNavigationState(state => {
    if (!state) return null;
    const route = state.routes[state.index];
    return route.name;
  });

  useEffect(() => {
    if (routeName && currentRoute.current !== routeName) {
      currentRoute.current = routeName;
      sessionTracker.trackScreenView(routeName);
      console.log('Screen changed to:', routeName);
    }
  }, [routeName]);

  // This component doesn't render anything, it just tracks navigation
  return null;
} 