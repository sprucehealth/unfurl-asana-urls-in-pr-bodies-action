import * as core from '@actions/core';

/**
 * Extract Asana task GIDs from text content
 * Handles various Asana URL formats
 *
 * @param text Text containing Asana task URLs
 * @returns Array of unique Asana task GIDs
 */
export function getAsanaTaskGIDsFromText(text: string): string[] {
  core.info(`Extracting Asana task IDs from: ${text}`);

  const asanaTaskGIDsInBodySorted = text
    .split('\r\n')
    .flatMap((line) => line.split('\n'))
    .flatMap((line) => {
      core.debug(`Processing line: ${line}`);

      // Match task URLs with /task/{id} format first (most reliable)
      let match = line.match(/https:\/\/app.asana.com(?:.*?)\/(?:task|item)\/(?<taskGID>\d+)/);

      if (match && match.groups) {
        core.debug(`Found match using task/item pattern: ${match.groups.taskGID}`);
      }

      // If no match, try the format /project/{project_id}/task/{task_id}
      if (!match || !match.groups) {
        match = line.match(
          /https:\/\/app.asana.com(?:.*?)\/project\/(?:\d+)\/task\/(?<taskGID>\d+)/
        );
        if (match && match.groups) {
          core.debug(`Found match using project/task pattern: ${match.groups.taskGID}`);
        }
      }

      // SPECIFIC FIX: Add pattern for the URL format in the logs
      // Format: https://app.asana.com/1/7423375154038/project/1201497668075595/task/1209677646439414
      if (!match || !match.groups) {
        match = line.match(
          /https:\/\/app.asana.com\/\d+\/\d+\/project\/\d+\/task\/(?<taskGID>\d+)/
        );
        if (match && match.groups) {
          core.debug(`Found match using workspace/project/task format: ${match.groups.taskGID}`);
        }
      }

      // If no match, try the old V0 format as fallback
      if (!match || !match.groups) {
        match = line.match(
          /https:\/\/app.asana.com(?:\/(?:[0-9]+|board|search|inbox))+(?:\/(?<taskGID>[0-9]+))+/
        );

        // For V0 format we need to make sure we're not matching workspace/project IDs
        // Only use this if we can't find a /task/ pattern in the URL
        if (match && line.includes('/task/')) {
          match = null; // Reset match as it's likely a workspace ID in a task URL
        }

        if (match && match.groups) {
          core.debug(`Found match using V0 format: ${match.groups.taskGID}`);
        }
      }

      // Also try to match item format: /inbox/<domainUser_id>/item/<item_id>
      if (!match || !match.groups) {
        match = line.match(/https:\/\/app.asana.com\/inbox\/\d+\/item\/(?<taskGID>\d+)/);

        if (match && match.groups) {
          core.debug(`Found match using inbox/item format: ${match.groups.taskGID}`);
        }
      }

      if (!match || !match.groups) {
        core.debug('No match found for line');
        return [];
      }

      const { taskGID } = match.groups;
      return taskGID;
    })
    .sort((a, b) => a.localeCompare(b));

  core.info(`Extracted task GIDs: ${asanaTaskGIDsInBodySorted}`);

  const allUniqueAsanaGIDsSorted = Array.from(new Set([...asanaTaskGIDsInBodySorted])).sort(
    (a, b) => a.localeCompare(b)
  );

  core.info(`Final unique task GIDs: ${allUniqueAsanaGIDsSorted}`);
  return allUniqueAsanaGIDsSorted;
}
