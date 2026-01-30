import type { GitHubCommit, GitHubIssueComment, GitHubPullRequest, GitHubReview, GitHubReviewComment } from '@/types/github-api';
import { sql } from './db';
import { GitHubService } from './github-service';

export interface MonthData {
  pr: GitHubPullRequest;
  commits: GitHubCommit[];
  reviews: GitHubReview[];
  reviewComments: GitHubReviewComment[];
  issueComments: GitHubIssueComment[];
}

export class DatabaseSyncService {
  private githubService: GitHubService;

  constructor(githubService: GitHubService) {
    this.githubService = githubService;
  }

  async syncMonthData(month: string, repoOwner: string, repoName: string) {
    try {
      const monthData = await this.githubService.getCompleteMonthData(month);
      const stats = await this.saveMonthData(monthData, month, repoOwner, repoName);
      await this.updatePerformanceStats(month);
      
      return {
        success: true,
        message: `Successfully synced ${stats.processedPRs} PRs with ${stats.totalComments} comments`,
        data: stats
      };
      
    } catch (error) {
      throw error;
    }
  }

  private async saveMonthData(monthData: MonthData[], month: string, repoOwner: string, repoName: string) {
    let processedPRs = 0;
    let totalComments = 0;

    for (const { pr, commits, reviews, reviewComments, issueComments } of monthData) {
      
      const author = await this.ensureMember(pr.user.login);
      
      const receivedCommentsCount = reviewComments.length + issueComments.length;
      const receivedReviewsCount = reviews.length;

      try {
        await sql`
          INSERT INTO pr_activities (
            member_id, pr_number, pr_title, pr_state, commits_count,
            received_comments_count, received_reviews_count,
            created_at, updated_at, merged_at, month, repo_owner, repo_name, pr_url
          )
          VALUES (
            ${author.id}, ${pr.number}, ${pr.title}, ${pr.state}, ${commits.length},
            ${receivedCommentsCount}, ${receivedReviewsCount},
            ${pr.created_at}, ${pr.updated_at}, ${pr.merged_at}, ${month}, 
            ${repoOwner}, ${repoName}, ${pr.html_url}
          )
          ON CONFLICT (member_id, pr_number, repo_owner, repo_name)
          DO UPDATE SET
            pr_title = EXCLUDED.pr_title,
            pr_state = EXCLUDED.pr_state,
            commits_count = EXCLUDED.commits_count,
            received_comments_count = EXCLUDED.received_comments_count,
            received_reviews_count = EXCLUDED.received_reviews_count,
            updated_at = EXCLUDED.updated_at,
            merged_at = EXCLUDED.merged_at,
            pr_url = EXCLUDED.pr_url
        `;
      } catch (error) {
        if (error instanceof Error) {
          console.error(error);
          throw error;
        }
      }

      for (const review of reviews) {
        if (!review.user) continue;
        
        const reviewer = await this.ensureMember(review.user.login);
        
        try {
          await sql`
            INSERT INTO review_activities (
              reviewer_id, pr_number, pr_author_id, review_type, review_state,
              comment_count, reviewed_at, month, repo_owner, repo_name
            )
            VALUES (
              ${reviewer.id}, ${pr.number}, ${author.id}, 'review', ${review.state},
              1, ${review.submitted_at}, ${month}, ${repoOwner}, ${repoName}
            )
            ON CONFLICT DO NOTHING
          `;
        } catch (error) {
          if (error instanceof Error) {
            console.error("Error inserting review activity: ", error);
            throw error;
          }
        }
      }

      for (const comment of reviewComments) {
        if (!comment.user) continue;
        
        const commenter = await this.ensureMember(comment.user.login);
        const isSubstantive = this.isSubstantiveComment(comment.body);
        
        try {
          await sql`
            INSERT INTO comment_details (
              commenter_id, pr_number, pr_author_id, comment_type,
              comment_length, is_substantive, created_at, month,
              repo_owner, repo_name, github_comment_id
            )
            VALUES (
              ${commenter.id}, ${pr.number}, ${author.id}, 'review_comment',
              ${comment.body.length}, ${isSubstantive}, ${comment.created_at}, ${month},
              ${repoOwner}, ${repoName}, ${comment.id}
            )
            ON CONFLICT (github_comment_id, repo_owner, repo_name) DO UPDATE SET
              comment_length = EXCLUDED.comment_length,
              is_substantive = EXCLUDED.is_substantive
          `;
          totalComments++;
        } catch (error) {
          if (error instanceof Error) {
            console.error("Error inserting review comment", error);
            throw error;
          }
        }
      }

      for (const comment of issueComments) {
        if (!comment.user) continue;
        
        const commenter = await this.ensureMember(comment.user.login);
        const isSubstantive = this.isSubstantiveComment(comment.body);
        
        try {
          await sql`
            INSERT INTO comment_details (
              commenter_id, pr_number, pr_author_id, comment_type,
              comment_length, is_substantive, created_at, month,
              repo_owner, repo_name, github_comment_id
            )
            VALUES (
              ${commenter.id}, ${pr.number}, ${author.id}, 'issue_comment',
              ${comment.body.length}, ${isSubstantive}, ${comment.created_at}, ${month},
              ${repoOwner}, ${repoName}, ${comment.id}
            )
            ON CONFLICT (github_comment_id, repo_owner, repo_name) DO UPDATE SET
              comment_length = EXCLUDED.comment_length,
              is_substantive = EXCLUDED.is_substantive
          `;
          totalComments++;
        } catch (error) {
          if (error instanceof Error) {
            console.error('Error inserting issue comment:', error);
            throw error;
          }
        }
      }

      processedPRs++;
    }

    return { processedPRs, totalComments, totalItems: monthData.length };
  }

  private async updatePerformanceStats(month: string) {
    
    const members = await sql`SELECT * FROM team_members WHERE is_active = true`;

    for (const member of members) {
      const prStats = await sql`
        SELECT 
          COUNT(*) as prs_count,
          COALESCE(SUM(commits_count), 0) as commits_count,
          COALESCE(SUM(received_comments_count), 0) as received_comments_count
        FROM pr_activities 
        WHERE member_id = ${member.id} AND month = ${month}
      `;

      const commentStats = await sql`
        SELECT 
          COUNT(*) as total_comments,
          COUNT(CASE WHEN is_substantive = true THEN 1 END) as substantive_comments,
          COALESCE(SUM(comment_length), 0) as total_comment_length
        FROM comment_details 
        WHERE commenter_id = ${member.id} AND month = ${month}
      `;

      const reviewStats = await sql`
        SELECT COUNT(*) as reviews_count
        FROM review_activities 
        WHERE reviewer_id = ${member.id} AND month = ${month}
      `;

      await sql`
        INSERT INTO team_performances (
          member_id, month, commits_count, prs_count, 
          review_comments_count, pr_comments_count, total_comments_count
        )
        VALUES (
          ${member.id}, ${month}, 
          ${prStats[0].commits_count}, ${prStats[0].prs_count},
          ${commentStats[0].total_comments}, ${prStats[0].received_comments_count},
          ${commentStats[0].total_comments}
        )
        ON CONFLICT (member_id, month)
        DO UPDATE SET 
          commits_count = EXCLUDED.commits_count,
          prs_count = EXCLUDED.prs_count,
          review_comments_count = EXCLUDED.review_comments_count,
          pr_comments_count = EXCLUDED.pr_comments_count,
          total_comments_count = EXCLUDED.total_comments_count,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
  }

  private async ensureMember(githubId: string) {
    const existing = await sql`SELECT * FROM team_members WHERE github_id = ${githubId}`;
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const newMember = await sql`
      INSERT INTO team_members (name, github_id, track_id, track_name)
      VALUES (${githubId}, ${githubId}, 'unknown', 'Unknown Track')
      RETURNING *
    `;
    
    return newMember[0];
  }

  private isSubstantiveComment(body: string): boolean {
    const cleanBody = body.trim().toLowerCase();
    
    if (cleanBody.length < 10) return false;
    
    const simpleResponses = ['👍', ':+1:', '수고하셨습니다.', '수고하셨습니다!'];
    if (simpleResponses.some(response => cleanBody === response)) return false;
    
    if (cleanBody.includes('```') || cleanBody.includes('http') || cleanBody.length > 50) {
      return true;
    }
    
    return cleanBody.length > 10;
  }
}