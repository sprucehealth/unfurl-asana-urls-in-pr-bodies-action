import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as asana from 'asana';
import { getAsanaTaskGIDsFromText } from './getAsanaTaskGIDsFromText';

/**
 * Find plain Asana URLs that are not part of markdown links
 * @param text Text to search for Asana URLs
 * @returns Array of plain Asana URLs
 */
function findPlainAsanaUrls(text: string): string[] {
  core.debug('Finding plain Asana URLs (not in markdown links)');

  // URLs that might be part of markdown links
  const markdownLinkRegex = /\[([^\]]*)\][(](https:\/\/app\.asana\.com\/[^)]+)[)]/g;
  const markdownUrls = new Set<string>();

  let match;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    markdownUrls.add(match[2]); // Add the URL part
    core.debug(`Found URL in markdown link: ${match[2]}`);
  }

  // Find all Asana URLs
  const asanaUrlRegex = /https:\/\/app\.asana\.com\/[^\s<>"()]+/g;
  const allUrls: string[] = [];

  while ((match = asanaUrlRegex.exec(text)) !== null) {
    const url = match[0];
    // Only include URLs that aren't already part of markdown links
    if (!markdownUrls.has(url)) {
      core.debug(`Found plain Asana URL: ${url}`);
      allUrls.push(url);
    }
  }

  core.info(`Found ${allUrls.length} plain Asana URLs (not in markdown links)`);
  return allUrls;
}

/**
 * Normalize whitespace for comparison
 * @param text Text to normalize
 * @returns Normalized text
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Main function to unfurl Asana URLs in PR bodies
 */
export async function unfurlAsanaUrls(): Promise<void> {
  try {
    core.info('🔄 Starting Asana URL unfurling process');

    // Get inputs
    const githubToken = core.getInput('githubToken', { required: true });
    const asanaToken = core.getInput('asanaToken', { required: true });

    core.info('✅ Retrieved access tokens');

    const octokit = new Octokit({ auth: githubToken });
    const asanaClient = asana.Client.create().useAccessToken(asanaToken);

    // Only run on pull_request event
    if (github.context.eventName !== 'pull_request') {
      core.info('⏭️ This action only runs on pull_request events. Skipping.');
      return;
    }

    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      core.setFailed('❌ Could not get pull request number from context');
      return;
    }

    core.info(`🔍 Processing PR #${prNumber}`);

    // Get PR data
    const { data: pullRequest } = await octokit.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
    });

    const originalBody = pullRequest.body || '';
    core.debug(`Original PR body length: ${originalBody.length} characters`);

    // Create a working copy of the PR body
    let updatedBody = originalBody;

    // Step 1: Process existing markdown links to Asana
    core.info('🔍 Processing existing markdown links to Asana tasks');
    const markdownLinkRegex = /\[([^\]]*)\][(](https:\/\/app\.asana\.com\/[^)]+)[)]/g;
    const processedUrls = new Set<string>();

    // Track all replacements to avoid duplicates
    const replacements: Array<{ original: string; replacement: string }> = [];

    // First pass: Update existing markdown links
    let markdownMatch;
    while ((markdownMatch = markdownLinkRegex.exec(originalBody)) !== null) {
      const [fullMatch, linkText, asanaUrl] = markdownMatch;
      core.debug(`Found markdown link: [${linkText}](${asanaUrl})`);

      const taskIds = getAsanaTaskGIDsFromText(asanaUrl);

      if (taskIds.length === 1) {
        const taskId = taskIds[0];
        processedUrls.add(asanaUrl);

        core.info(`📋 Found Asana task ID in markdown link: ${taskId}`);

        try {
          // Get the task title from Asana
          core.debug(`Fetching Asana task details for task ID: ${taskId}`);
          const task = await asanaClient.tasks.getTask(taskId);
          const taskTitle = task.name;

          core.info(`📝 Task ${taskId} title: "${taskTitle}"`);

          // Only update if the title has changed
          if (linkText !== taskTitle) {
            core.info(`🔄 Updating markdown link text from "${linkText}" to "${taskTitle}"`);
            replacements.push({
              original: fullMatch,
              replacement: `[${taskTitle}](${asanaUrl})`,
            });
          } else {
            core.info(`✅ Link text already matches task title: "${taskTitle}"`);
          }
        } catch (error) {
          core.warning(
            `⚠️ Failed to fetch Asana task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (taskIds.length > 1) {
        core.warning(`⚠️ Found multiple task IDs in a single URL, skipping: ${asanaUrl}`);
      } else {
        core.debug(`No valid Asana task ID found in URL: ${asanaUrl}`);
      }
    }

    // Step 2: Find plain Asana URLs that aren't part of markdown links
    core.info('🔍 Processing plain Asana URLs');
    const plainUrlMatches = findPlainAsanaUrls(originalBody);

    for (const asanaUrl of plainUrlMatches) {
      // Skip URLs we've already processed
      if (processedUrls.has(asanaUrl)) {
        core.debug(`Skipping already processed URL: ${asanaUrl}`);
        continue;
      }

      const taskIds = getAsanaTaskGIDsFromText(asanaUrl);
      if (taskIds.length === 1) {
        const taskId = taskIds[0];
        core.info(`📋 Found Asana task ID in plain URL: ${taskId}`);

        try {
          // Get the task title from Asana
          core.debug(`Fetching Asana task details for task ID: ${taskId}`);
          const task = await asanaClient.tasks.getTask(taskId);
          const taskTitle = task.name;

          core.info(`📝 Converting plain URL to markdown link with title: "${taskTitle}"`);
          replacements.push({
            original: asanaUrl,
            replacement: `[${taskTitle}](${asanaUrl})`,
          });
        } catch (error) {
          core.warning(
            `⚠️ Failed to fetch Asana task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (taskIds.length > 1) {
        core.warning(`⚠️ Found multiple task IDs in a single URL, skipping: ${asanaUrl}`);
      } else {
        core.debug(`No valid Asana task ID found in URL: ${asanaUrl}`);
      }
    }

    // Apply all replacements
    core.info(`🔄 Applying ${replacements.length} replacements to PR body`);
    for (const { original, replacement } of replacements) {
      updatedBody = updatedBody.replace(original, replacement);
    }

    // Compare bodies (ignoring whitespace)
    const normalizedOriginal = normalizeWhitespace(originalBody);
    const normalizedUpdated = normalizeWhitespace(updatedBody);

    if (normalizedOriginal !== normalizedUpdated) {
      core.info('🔄 PR body has been modified, updating...');

      // Update the PR body
      await octokit.pulls.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: prNumber,
        body: updatedBody,
      });

      core.info(`✅ Successfully updated PR #${prNumber} with enhanced Asana links`);
      core.setOutput('updated', 'true');
      core.setOutput('updatedCount', replacements.length.toString());
    } else {
      core.info('✅ No meaningful changes to make to the PR body');
      core.setOutput('updated', 'false');
      core.setOutput('updatedCount', '0');
    }
  } catch (error) {
    core.setFailed(`❌ Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the action
unfurlAsanaUrls();
