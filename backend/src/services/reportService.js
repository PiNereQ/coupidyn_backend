import pool from '../config/db.js';

export const addReport = async (reportingUserId, reportedUserId, couponId, reportReason, reportDetails) => {
  try {
    console.log('Adding report with details:', { reportingUserId, reportedUserId, couponId, reportReason, reportDetails });
    const result = await pool.query(`
        INSERT INTO reports (reporting_user_id, reported_user_id, coupon_id, report_reason, report_details)
        VALUES (?, ?, ?, ?, ?);
    `, [ reportingUserId, reportedUserId, couponId, reportReason, reportDetails ]);
    console.log('Report added successfully:', result);
    return {success: true};
  } catch (error) {
    console.error('Error adding report:', error);
    throw error;
  }
};