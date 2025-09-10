import { createTables } from '@/lib/db-setup';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.body;

    // TODO: db 삭제, 초기화
    switch (action) {
      case 'create':
        await createTables();
        return res.status(200).json({ 
          success: true, 
          message: 'Tables created successfully' 
        });        
      default:
        return res.status(400).json({
          error: 'Invalid action. Use: create, drop, reset, or sample'
        });
    }
    
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Database setup failed',
        details: error.message
      });
    }


  }
}