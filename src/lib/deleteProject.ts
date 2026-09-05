import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function deleteProjectWithRelatedData(projectId: string) {
  const stepResults = await getDocs(query(collection(db, 'step_results'), where('projectId', '==', projectId)));
  const feedbackRef = doc(db, 'mentor_feedbacks', projectId);
  const feedback = await getDoc(feedbackRef);
  const batch = writeBatch(db);

  stepResults.docs.forEach((stepResult) => batch.delete(stepResult.ref));
  if (feedback.exists()) batch.delete(feedbackRef);
  batch.delete(doc(db, 'projects', projectId));
  await batch.commit();
}
