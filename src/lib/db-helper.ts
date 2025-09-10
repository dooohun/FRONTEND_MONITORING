import { sql } from './db';

export const teamMemberQueries = {
  async getAll() {
    try {
      const result = await sql`
        SELECT * FROM team_members 
        WHERE is_active = true 
        ORDER BY track_id, name
      `;
      return result;
    } catch (error) {
      console.error('Error fetching all team members:', error);
      throw error;
    }
  },

  async getByGithubId(githubId: string) {
    try {
      const result = await sql`
        SELECT * FROM team_members 
        WHERE github_id = ${githubId} AND is_active = true
      `;
      return result[0];
    } catch (error) {
      console.error('Error fetching team member by GitHub ID:', error);
      throw error;
    }
  },

  async upsert(memberData: {
    name: string;
    githubId: string;
    trackId: string;
    trackName: string;
  }) {
    try {
      const result = await sql`
        INSERT INTO team_members (name, github_id, track_id, track_name)
        VALUES (${memberData.name}, ${memberData.githubId}, ${memberData.trackId}, ${memberData.trackName})
        ON CONFLICT (github_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          track_id = EXCLUDED.track_id,
          track_name = EXCLUDED.track_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      return result[0];
    } catch (error) {
      console.error('Error upserting team member:', error);
      throw error;
    }
  }
};

export const performanceQueries = {
  async getLeaderboard(month: string) {
    try {
      const result = await sql`
        SELECT 
          tm.id,
          tm.name,
          tm.github_id,
          tm.track_name,
          COALESCE(tp.commits_count, 0) as commits_count,
          COALESCE(tp.prs_count, 0) as prs_count,
          COALESCE(tp.reviews_count, 0) as reviews_count
        FROM team_members tm
        LEFT JOIN team_performances tp ON tm.id = tp.member_id AND tp.month = ${month}
        WHERE tm.is_active = true
        ORDER BY 
          (COALESCE(tp.commits_count, 0) + COALESCE(tp.prs_count, 0) * 2 + COALESCE(tp.reviews_count, 0)) DESC;
      `;
      return result;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  },

  async getMemberPerformance(memberId: string, month: string) {
    try {
      const result = await sql`
        SELECT 
          tp.*,
          tm.name,
          tm.github_id,
          tm.track_name
        FROM team_performances tp
        JOIN team_members tm ON tp.member_id = tm.id
        WHERE tp.member_id = ${memberId} AND tp.month = ${month};
      `;
      return result[0];
    } catch (error) {
      console.error('Error fetching member performance:', error);
      throw error;
    }
  },

  async upsertPerformance(data: {
    memberId: string;
    month: string;
    commitsCount: number;
    prsCount: number;
    reviewsCount: number;
  }) {
    try {
      const result = await sql`
        INSERT INTO team_performances (member_id, month, commits_count, prs_count, reviews_count)
        VALUES (${data.memberId}, ${data.month}, ${data.commitsCount}, ${data.prsCount}, ${data.reviewsCount})
        ON CONFLICT (member_id, month)
        DO UPDATE SET 
          commits_count = EXCLUDED.commits_count,
          prs_count = EXCLUDED.prs_count,
          reviews_count = EXCLUDED.reviews_count,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      return result[0];
    } catch (error) {
      console.error('Error upserting performance:', error);
      throw error;
    }
  }
};

export const prActivityQueries = {
  async upsert(data: {
    memberId: string;
    prNumber: number;
    prTitle: string;
    prState: string;
    commitsCount: number;
    createdAt: Date;
    updatedAt: Date;
    mergedAt?: Date | null;
    month: string;
    repoOwner: string;
    repoName: string;
    prUrl: string;
  }) {
    try {
      const result = await sql`
        INSERT INTO pr_activities (
          member_id, pr_number, pr_title, pr_state, commits_count,
          created_at, updated_at, merged_at, month, repo_owner, repo_name, pr_url
        )
        VALUES (
          ${data.memberId}, ${data.prNumber}, ${data.prTitle}, ${data.prState}, ${data.commitsCount},
          ${data.createdAt}, ${data.updatedAt}, ${data.mergedAt}, ${data.month}, 
          ${data.repoOwner}, ${data.repoName}, ${data.prUrl}
        )
        ON CONFLICT (member_id, pr_number, repo_owner, repo_name)
        DO UPDATE SET 
          pr_title = EXCLUDED.pr_title,
          pr_state = EXCLUDED.pr_state,
          commits_count = EXCLUDED.commits_count,
          updated_at = EXCLUDED.updated_at,
          merged_at = EXCLUDED.merged_at,
          pr_url = EXCLUDED.pr_url
        RETURNING *;
      `;
      return result[0];
    } catch (error) {
      console.error('Error upserting PR activity:', error);
      throw error;
    }
  },

  async getMemberActivities(memberId: string, month: string) {
    try {
      const result = await sql`
        SELECT * FROM pr_activities 
        WHERE member_id = ${memberId} AND month = ${month}
        ORDER BY created_at DESC;
      `;
      return result;
    } catch (error) {
      console.error('Error fetching member PR activities:', error);
      throw error;
    }
  }
};

export const reviewActivityQueries = {
  async create(data: {
    memberId: string;
    prNumber: number;
    prAuthor: string;
    reviewState: string;
    reviewedAt: Date;
    month: string;
    repoOwner: string;
    repoName: string;
  }) {
    try {
      const result = await sql`
        INSERT INTO review_activities (
          member_id, pr_number, pr_author, review_state, reviewed_at,
          month, repo_owner, repo_name
        )
        VALUES (
          ${data.memberId}, ${data.prNumber}, ${data.prAuthor}, ${data.reviewState},
          ${data.reviewedAt}, ${data.month}, ${data.repoOwner}, ${data.repoName}
        )
        RETURNING *;
      `;
      return result[0];
    } catch (error) {
      console.error('Error creating review activity:', error);
      throw error;
    }
  },

  async getMemberActivities(memberId: string, month: string) {
    try {
      const result = await sql`
        SELECT * FROM review_activities 
        WHERE member_id = ${memberId} AND month = ${month}
        ORDER BY reviewed_at DESC;
      `;
      return result;
    } catch (error) {
      console.error('Error fetching member review activities:', error);
      throw error;
    }
  }
};