import type { NextApiRequest, NextApiResponse } from 'next';
import { GitHubService } from '@/lib/github-service';
import { DatabaseSyncService } from '@/lib/db-sync';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month, repoOwner, repoName } = req.body;

    // 파라미터 검증
    if (!month || !repoOwner || !repoName) {
      return res.status(400).json({
        error: 'Missing required parameters: month, repoOwner, repoName'
      });
    }

    // 환경변수 검증
    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({
        error: 'GitHub token not configured. Please set GITHUB_TOKEN environment variable.'
      });
    }

    const githubService = new GitHubService({
      token: process.env.GITHUB_TOKEN,
      owner: repoOwner,
      repo: repoName,
    });

    const syncService = new DatabaseSyncService(githubService);

    const result = await syncService.syncMonthData(month, repoOwner, repoName);

    return res.status(200).json(result);

  } catch (error) {

    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Internal server error during sync',
        details: error.message
      });
    }
  }
}