import type { GetServerSideProps } from 'next';
import GitHubTeamDashboard from '@/components/GitHubTeamDashboard';
import { sql } from '@/lib/db';
interface PerformanceData {
  id: string;
  name: string;
  github_id: string;
  track_name: string;
  commits_count: number;
  prs_count: number;
  review_comments_count: number;
  total_comments_count: number;
  pr_comments_count: number;
}

interface DashboardPageProps {
  initialData: PerformanceData[];
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async () => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const performances = await sql`
      SELECT 
        tm.id::text as id,
        tm.name::text as name,
        tm.github_id::text as github_id,
        tm.track_name::text as track_name,
        COALESCE(tp.commits_count, 0)::integer as commits_count,
        COALESCE(tp.prs_count, 0)::integer as prs_count,
        COALESCE(tp.review_comments_count, 0)::integer as review_comments_count,
        COALESCE(tp.total_comments_count, 0)::integer as total_comments_count,
        COALESCE(tp.pr_comments_count, 0)::integer as pr_comments_count
      FROM team_members tm
      LEFT JOIN team_performances tp ON tm.id = tp.member_id AND tp.month = ${currentMonth}
      WHERE tm.is_active = true
      ORDER BY tm.name
    `;

    // 타입 안전하게 변환
    const typedPerformances: PerformanceData[] = performances.map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      github_id: String(row.github_id),
      track_name: String(row.track_name),
      commits_count: Number(row.commits_count) || 0,
      prs_count: Number(row.prs_count) || 0,
      review_comments_count: Number(row.review_comments_count) || 0,
      total_comments_count: Number(row.total_comments_count) || 0,
      pr_comments_count: Number(row.pr_comments_count) || 0,
    }));

    return {
      props: {
        initialData: typedPerformances
      }
    };
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    return {
      props: {
        initialData: []
      }
    };
  }
};

export default function DashboardPage({ initialData }: DashboardPageProps) {
  return <GitHubTeamDashboard initialData={initialData} />;
};
