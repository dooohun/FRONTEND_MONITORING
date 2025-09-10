import type { GitHubPullRequest } from "@/types/github-api";

interface GitHubReviewComment {
  id: number;
  user: {
    login: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string;
  path: string;
  line: number | null;
}

interface GitHubIssueComment {
  id: number;
  user: {
    login: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string;
}

const BASE_URL = 'https://api.github.com';

export class GitHubService {
  private config: {
    token: string;
    owner: string;
    repo: string;
  };

  constructor(config: { token: string; owner: string; repo: string }) {
    this.config = config;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async getAllPRComments(prNumber: number) {
    const [reviews, reviewComments, issueComments] = await Promise.all([
      this.getPRReviews(prNumber),
      this.getPRReviewComments(prNumber),
      this.getPRIssueComments(prNumber)
    ]);
    return {
      reviews,
      reviewComments,
      issueComments
    };
  }

  async getPRReviewComments(prNumber: number): Promise<GitHubReviewComment[]> {
    const response = await fetch(
      `${BASE_URL}/repos/${this.config.owner}/${this.config.repo}/pulls/${prNumber}/comments`,
      { headers: this.headers }
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  async getPRIssueComments(prNumber: number): Promise<GitHubIssueComment[]> {
    const response = await fetch(
      `${BASE_URL}/repos/${this.config.owner}/${this.config.repo}/issues/${prNumber}/comments`,
      { headers: this.headers }
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  async getPRsForMonth(month: string): Promise<GitHubPullRequest[]> {
    const dateRange = this.getMonthDateRange(month);
    const fromDate = dateRange.from.toISOString().split('T')[0];
    const toDate = dateRange.to.toISOString().split('T')[0];

    const query = `repo:${this.config.owner}/${this.config.repo} type:pr created:${fromDate}..${toDate}`;

    let allPRs: GitHubPullRequest[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(
        `${BASE_URL}/search/issues?q=${encodeURIComponent(query)}&page=${page}&per_page=100`,
        { headers: this.headers }
      );

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      const data = await response.json();
      const prs = data.items;
      
      if (prs.length === 0) break;
      allPRs = [...allPRs, ...prs];
      if (prs.length < 100) break;
      page++;
      
      await this.delay(1000);
    }

    return allPRs;
  }

  async getPRCommits(prNumber: number) {
    const response = await fetch(
      `${BASE_URL}/repos/${this.config.owner}/${this.config.repo}/pulls/${prNumber}/commits`,
      { headers: this.headers }
    );

    if (!response.ok) return [];
    return response.json();
  }

  async getPRReviews(prNumber: number) {
    const response = await fetch(
      `${BASE_URL}/repos/${this.config.owner}/${this.config.repo}/pulls/${prNumber}/reviews`,
      { headers: this.headers }
    );

    if (!response.ok) return [];
    return response.json();
  }

  async getCompleteMonthData(month: string) {
    const prs = await this.getPRsForMonth(month);
    const results = [];

    for (let i = 0; i < prs.length; i++) {
      const pr = prs[i];
      try {
        const [commits, commentData] = await Promise.all([
          this.getPRCommits(pr.number),
          this.getAllPRComments(pr.number)
        ]);

        results.push({
          pr,
          commits,
          ...commentData
        });

        await this.delay(500);
        
      } catch (error) {
        results.push({
          pr,
          commits: [],
          reviews: [],
          reviewComments: [],
          issueComments: []
        });
      }
    }

    return results;
  }

  private getMonthDateRange(month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const from = new Date(year, monthNum - 1, 1);
    const to = new Date(year, monthNum, 0, 23, 59, 59);
    return { from, to };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}