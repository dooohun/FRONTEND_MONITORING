import { sql } from './db';

export const createTables = async () => {
  try {

    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id VARCHAR(30) PRIMARY KEY DEFAULT 'tm_' || substr(md5(random()::text), 1, 25),
        name VARCHAR(100) NOT NULL,
        github_id VARCHAR(100) UNIQUE NOT NULL,
        track_id VARCHAR(50) NOT NULL,
        track_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS team_performances (
        id VARCHAR(30) PRIMARY KEY DEFAULT 'tp_' || substr(md5(random()::text), 1, 25),
        member_id VARCHAR(30) NOT NULL,
        month VARCHAR(7) NOT NULL,
        commits_count INTEGER DEFAULT 0,
        prs_count INTEGER DEFAULT 0,
        review_comments_count INTEGER DEFAULT 0,  -- 리뷰 코멘트 수
        pr_comments_count INTEGER DEFAULT 0,     -- PR 코멘트 수 (받은 것)
        total_comments_count INTEGER DEFAULT 0,   -- 총 코멘트 수
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE,
        UNIQUE(member_id, month)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pr_activities (
        id VARCHAR(30) PRIMARY KEY DEFAULT 'pr_' || substr(md5(random()::text), 1, 25),
        member_id VARCHAR(30) NOT NULL,
        pr_number INTEGER NOT NULL,
        pr_title TEXT NOT NULL,
        pr_state VARCHAR(20) NOT NULL,
        commits_count INTEGER NOT NULL,
        received_comments_count INTEGER DEFAULT 0,  -- 이 PR에 받은 총 코멘트 수
        received_reviews_count INTEGER DEFAULT 0,   -- 이 PR에 받은 리뷰 수
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        merged_at TIMESTAMP,
        month VARCHAR(7) NOT NULL,
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        pr_url TEXT NOT NULL,
        FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE,
        UNIQUE(member_id, pr_number, repo_owner, repo_name)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS review_activities (
        id VARCHAR(30) PRIMARY KEY DEFAULT 'rv_' || substr(md5(random()::text), 1, 25),
        reviewer_id VARCHAR(30) NOT NULL,           -- 리뷰어 ID
        pr_number INTEGER NOT NULL,
        pr_author_id VARCHAR(30) NOT NULL,          -- PR 작성자 ID (FK)
        review_type VARCHAR(20) NOT NULL,           -- 'review' 또는 'comment'
        review_state VARCHAR(20),                   -- APPROVED, REQUEST_CHANGES, COMMENTED (review일 때만)
        comment_count INTEGER DEFAULT 0,           -- 이 리뷰/코멘트의 글자 수 또는 중요도
        reviewed_at TIMESTAMP NOT NULL,
        month VARCHAR(7) NOT NULL,
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        FOREIGN KEY (reviewer_id) REFERENCES team_members(id) ON DELETE CASCADE,
        FOREIGN KEY (pr_author_id) REFERENCES team_members(id) ON DELETE CASCADE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS comment_details (
        id VARCHAR(30) PRIMARY KEY DEFAULT 'cd_' || substr(md5(random()::text), 1, 25),
        commenter_id VARCHAR(30) NOT NULL,          -- 코멘트 작성자
        pr_number INTEGER NOT NULL,
        pr_author_id VARCHAR(30) NOT NULL,          -- PR 작성자
        comment_type VARCHAR(20) NOT NULL,          -- 'review_comment', 'issue_comment', 'review_submission'
        comment_length INTEGER DEFAULT 0,          -- 코멘트 길이 (글자 수)
        is_substantive BOOLEAN DEFAULT false,      -- 의미있는 코멘트인지 (나중에 AI로 판단 가능)
        created_at TIMESTAMP NOT NULL,
        month VARCHAR(7) NOT NULL,
        repo_owner VARCHAR(100) NOT NULL,
        repo_name VARCHAR(100) NOT NULL,
        github_comment_id BIGINT,                  -- GitHub 코멘트 ID (중복 방지)
        FOREIGN KEY (commenter_id) REFERENCES team_members(id) ON DELETE CASCADE,
        FOREIGN KEY (pr_author_id) REFERENCES team_members(id) ON DELETE CASCADE,
        UNIQUE(github_comment_id, repo_owner, repo_name)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_team_performances_month ON team_performances(month);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pr_activities_member_month ON pr_activities(member_id, month);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_review_activities_reviewer_month ON review_activities(reviewer_id, month);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_comment_details_commenter_month ON comment_details(commenter_id, month);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_comment_details_pr_month ON comment_details(pr_number, month);`;
    
  } catch (error) {
    console.error('에러 발생', error);
    throw error;
  }
};
