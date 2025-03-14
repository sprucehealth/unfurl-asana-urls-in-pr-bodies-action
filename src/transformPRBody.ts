import { getAsanaTaskGIDsFromText } from './getAsanaTaskGIDsFromText';

interface TaskInfo {
  id: string;
  title: string;
  safeTitle: string;
}

interface TransformResult {
  body: string;
  changesApplied: boolean;
  updatedCount: number;
}

/**
 * Transforms a PR body by unfurling Asana URLs into markdown links with task titles
 * @param body The original PR body
 * @param fetchTaskTitle Function to fetch Asana task title (allows mocking in tests)
 * @returns The transformed PR body and metadata about changes
 */
export async function transformPRBody(
  body: string,
  fetchTaskTitle: (taskId: string) => Promise<string>
): Promise<TransformResult> {
  if (!body) {
    return { body: '', changesApplied: false, updatedCount: 0 };
  }

  // Map to store task IDs and their titles
  const taskInfoMap = new Map<string, TaskInfo>();

  // First, collect all Asana URLs from the text
  const allAsanaUrls = collectAllAsanaUrls(body);

  // Fetch all task titles in parallel (for performance)
  await Promise.all(
    [...new Set(allAsanaUrls)].map(async (url) => {
      const taskIds = getAsanaTaskGIDsFromText(url);
      if (taskIds.length === 1) {
        try {
          const title = await fetchTaskTitle(taskIds[0]);
          const safeTitle = sanitizeTitleForMarkdown(title);
          taskInfoMap.set(url, { id: taskIds[0], title, safeTitle });
        } catch {
          // Task fetch failed, ignore this URL
        }
      }
    })
  );

  // No tasks found or all fetches failed
  if (taskInfoMap.size === 0) {
    return { body, changesApplied: false, updatedCount: 0 };
  }

  // Process line by line to avoid nested markdown issues
  const lines = body.split('\n');
  let replacementCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // First, handle existing markdown links with Asana URLs
    const markdownRegex = /\[([^\]]+)\]\((https:\/\/app\.asana\.com\/[^)]+)\)/g;
    let markdownMatches = [...line.matchAll(markdownRegex)];

    for (const match of markdownMatches) {
      const [fullMatch, linkText, asanaUrl] = match;

      if (taskInfoMap.has(asanaUrl)) {
        const taskInfo = taskInfoMap.get(asanaUrl)!;

        // If the link text already matches the task title or contains nested brackets, preserve it
        if (linkText === taskInfo.title || linkText.includes('[')) {
          // Just count it as processed, but don't modify
          replacementCount++;
        } else {
          // Otherwise update to the safe title
          const newLink = `[${taskInfo.safeTitle}](${asanaUrl})`;
          line = line.replace(fullMatch, newLink);
          replacementCount++;
        }
      }
    }

    // Then, handle plain URLs (making sure not to match URLs within markdown links)
    // We need to re-check what's in the line after above replacements
    const updatedLine = line;
    const markdownIndices = findMarkdownLinkIndices(updatedLine);

    for (const [url, taskInfo] of taskInfoMap.entries()) {
      let startIndex = 0;
      let urlIndex: number;

      // Find all occurrences of this URL in the line
      while ((urlIndex = updatedLine.indexOf(url, startIndex)) !== -1) {
        // Check if this URL is already within a markdown link
        const isInMarkdownLink = markdownIndices.some(
          (range) => urlIndex >= range.start && urlIndex + url.length <= range.end
        );

        if (!isInMarkdownLink) {
          // This is a plain URL, convert it to a markdown link
          const newLink = `[${taskInfo.safeTitle}](${url})`;
          const before = updatedLine.substring(0, urlIndex);
          const after = updatedLine.substring(urlIndex + url.length);
          line = before + newLink + after;
          replacementCount++;

          // Update the search position for next iteration
          startIndex = urlIndex + newLink.length;
        } else {
          // Skip this occurrence and continue searching after it
          startIndex = urlIndex + url.length;
        }
      }
    }

    // Update the line in the array
    lines[i] = line;
  }

  // Join the lines back together to form the updated body
  const newBody = lines.join('\n');

  return {
    body: newBody,
    changesApplied: replacementCount > 0,
    updatedCount: replacementCount,
  };
}

/**
 * Finds indices of all markdown links in a string
 * @param text String to search
 * @returns Array of ranges for markdown links
 */
function findMarkdownLinkIndices(text: string): Array<{ start: number; end: number }> {
  const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const indices: Array<{ start: number; end: number }> = [];

  let match;
  while ((match = markdownRegex.exec(text)) !== null) {
    indices.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return indices;
}

/**
 * Sanitizes a title for use in markdown links by replacing square brackets with parentheses
 * @param title The original title
 * @returns A sanitized version of the title safe for markdown links
 */
function sanitizeTitleForMarkdown(title: string): string {
  return title.replace(/\[/g, '(').replace(/\]/g, ')');
}

/**
 * Collects all Asana URLs from a text
 * @param text The text to search for Asana URLs
 * @returns Array of Asana URLs
 */
function collectAllAsanaUrls(text: string): string[] {
  const asanaUrlRegex = /https:\/\/app\.asana\.com\/[^\s<>"()]+/g;
  const matches = [...text.matchAll(asanaUrlRegex)];
  return matches.map((match) => match[0]);
}
