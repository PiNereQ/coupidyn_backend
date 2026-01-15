import cron from 'node-cron';
import { computeAndStoreRecommendations } from '../services/recommendationEngine.js';
import pool from '../config/db.js';

/**
 * Initialize recommendation computation scheduler
 * Runs every 6 hours (2 AM, 8 AM, 2 PM, 8 PM)
 */
export const initializeRecommendationScheduler = () => {
  // Run every 6 hours
  cron.schedule('0 2,8,14,20 * * *', async () => {
    console.log(`⏰ [${new Date().toISOString()}] Starting recommendation computation... `);
    
    try {
      const [users] = await pool.query('SELECT DISTINCT id FROM users');
      console.log(`📊 Computing recommendations for ${users.length} users...`);
      
      let success = 0;
      let failed = 0;
      
      for (const user of users) {
        try {
          await computeAndStoreRecommendations(user.id);
          success++;
        } catch (error) {
          console.error(`❌ Failed for user ${user.id}:`, error.message);
          failed++;
        }
      }
      
      console.log(`✅ Finished:  ${success} successful, ${failed} failed`);
    } catch (error) {
      console.error('❌ Recommendation cron job error:', error);
    }
  });

  console.log('🚀 Recommendation scheduler initialized (every 6 hours:  2 AM, 8 AM, 2 PM, 8 PM)');
};

export const RecomOnce = async() => {
    try {
      const [users] = await pool.query('SELECT DISTINCT id FROM users');
      console.log(`📊 Computing recommendations for ${users.length} users...`);
      
      let success = 0;
      let failed = 0;
      
      for (const user of users) {
        try {
          await computeAndStoreRecommendations(user.id);
          success++;
        } catch (error) {
          console.error(`❌ Failed for user ${user.id}:`, error.message);
          failed++;
        }
      }
      
      console.log(`✅ Finished:  ${success} successful, ${failed} failed`);
    } catch (error) {
      console.error('❌ Recommendation cron job error:', error);
    }
}