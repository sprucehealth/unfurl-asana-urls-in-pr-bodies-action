"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unfurlAsanaUrls = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const rest_1 = require("@octokit/rest");
const asana = __importStar(require("asana"));
const transformPRBody_1 = require("./transformPRBody");
/**
 * Main function to unfurl Asana URLs in PR bodies
 */
async function unfurlAsanaUrls() {
    try {
        core.info('🔄 Starting Asana URL unfurling process');
        // Get inputs
        const githubToken = core.getInput('githubToken', { required: true });
        const asanaToken = core.getInput('asanaToken', { required: true });
        core.info('✅ Retrieved access tokens');
        const octokit = new rest_1.Octokit({ auth: githubToken });
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
        const fetchTaskTitle = async (taskId) => {
            core.debug(`Fetching Asana task details for task ID: ${taskId}`);
            const task = await asanaClient.tasks.getTask(taskId);
            const taskTitle = task.name;
            core.info(`📝 Task ${taskId} title: "${taskTitle}"`);
            return taskTitle;
        };
        // Transform the PR body
        const { body: updatedBody, changesApplied, updatedCount, } = await (0, transformPRBody_1.transformPRBody)(originalBody, fetchTaskTitle);
        // If changes were made, update the PR
        if (changesApplied) {
            core.info(`🔄 PR body has been modified with ${updatedCount} Asana link updates, updating...`);
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
        }
        else {
            core.info('✅ No changes made to the PR body');
            core.setOutput('updated', 'false');
            core.setOutput('updatedCount', '0');
        }
    }
    catch (error) {
        core.setFailed(`❌ Action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.unfurlAsanaUrls = unfurlAsanaUrls;
// Run the action
unfurlAsanaUrls();
