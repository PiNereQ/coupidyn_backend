import {
    addReport as addReportService
} from '../services/reportService.js';

export const addReport = async (req, res) => {
    console.log('addReport controller called with body:', req.body);
    const { reporter_id, reported_user_id, coupon_id, report_reason, report_details } = req.body;

    try {
        const report = await addReportService(reporter_id, reported_user_id, coupon_id, report_reason, report_details);
        res.status(201).json({ message: 'Report added successfully'});
    } catch (error) {
        console.error('Error in addReport controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};