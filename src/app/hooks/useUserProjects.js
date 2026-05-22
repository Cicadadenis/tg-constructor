import { useCallback, useState } from 'react';
import { apiFetch } from '../../apiClient.js';

async function fetchUserProjects() {
  try {
    const data = await apiFetch('/api/projects');
    return data.projects || [];
  } catch {
    return [];
  }
}

/**
 * Cloud project list for the profile modal and editor chrome.
 */
export function useUserProjects() {
  const [userProjects, setUserProjects] = useState([]);

  const loadUserProjects = useCallback(async (userId) => {
    if (!userId) {
      setUserProjects([]);
      return;
    }
    const projects = await fetchUserProjects();
    setUserProjects(projects);
  }, []);

  return { userProjects, setUserProjects, loadUserProjects };
}
