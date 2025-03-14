import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as asana from 'asana';
import { transformPRBody } from './transformPRBody';

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

    // Function to fetch task title from Asana
    const fetchTaskTitle = async (taskId: string): Promise<string> => {
      core.debug(`Fetching Asana task details for task ID: ${taskId}`);
      const task = await asanaClient.tasks.getTask(taskId);
      const taskTitle = task.name;
      core.info(`📝 Task ${taskId} title: "${taskTitle}"`);
      return taskTitle;
    };

    // Transform the PR body
    const {
      body: updatedBody,
      changesApplied,
      updatedCount,
    } = await transformPRBody(originalBody, fetchTaskTitle);

    // If changes were made, update the PR
    if (changesApplied) {
      core.info(
        `🔄 PR body has been modified with ${updatedCount} Asana link updates, updating...`
      );

      // Update the PR body
      await octokit.pulls.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: prNumber,
        body: updatedBody,
      });

      core.info(`✅ Successfully updated PR #${prNumber} with enhanced Asana links`);
      core.setOutput('updated', 'true');
      core.setOutput('updatedCount', updatedCount.toString());
    } else {
      core.info('✅ No changes made to the PR body');
      core.setOutput('updated', 'false');
      core.setOutput('updatedCount', '0');
    }
  } catch (error) {
    core.setFailed(`❌ Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the action
unfurlAsanaUrls();
