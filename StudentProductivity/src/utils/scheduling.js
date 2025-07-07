// Returns an array of { subject, topic, subjectId } objects not studied in N days
export function getNeglectedSubjects(subjects, days = 3) {
  const neglected = [];
  const now = new Date();
  
  // Add null check for subjects
  if (!subjects || !Array.isArray(subjects)) {
    return neglected;
  }
  
  subjects.forEach(subject => {
    if (subject.topics && Array.isArray(subject.topics)) {
      subject.topics.forEach(topic => {
        if (!topic.lastStudied) {
          neglected.push({ 
            subject: subject.name, 
            topic: topic.name,
            subjectId: subject.id 
          });
        } else {
          const last = new Date(topic.lastStudied);
          const diffDays = (now - last) / (1000 * 60 * 60 * 24);
          if (diffDays >= days) {
            neglected.push({ 
              subject: subject.name, 
              topic: topic.name,
              subjectId: subject.id 
            });
          }
        }
      });
    }
  });
  return neglected;
} 