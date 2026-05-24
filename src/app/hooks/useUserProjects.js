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
  const [projectsLoading, setProjectsLoading] = useState(false);

  const loadUserProjects = useCallback(async (userId) => {
    if (!userId) {
      setUserProjects([]);
      setProjectsLoading(false);
      return;
    }
    setProjectsLoading(true);
    try {
      const projects = await fetchUserProjects();
      setUserProjects(projects);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  return { userProjects, setUserProjects, loadUserProjects, projectsLoading };
}
