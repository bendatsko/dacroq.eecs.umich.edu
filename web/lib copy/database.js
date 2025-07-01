// lib/database.js
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

// Example function to fetch test results
export const fetchTestResults = async (userId) => {
    try {
        const q = query(collection(db, "testResults"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const results = [];

        querySnapshot.forEach((doc) => {
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return results;
    } catch (error) {
        console.error("Error fetching test results:", error);
        throw error;
    }
};

// Example function to fetch a specific test
export const fetchTest = async (testId) => {
    try {
        const testRef = doc(db, "tests", testId);
        const testSnap = await getDoc(testRef);

        if (testSnap.exists()) {
            return {
                id: testSnap.id,
                ...testSnap.data()
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching test:", error);
        throw error;
    }
};