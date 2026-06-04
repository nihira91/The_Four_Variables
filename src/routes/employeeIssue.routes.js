const express = require('express');
const router = express.Router();

const {
  createIssue,
  getEmployeeIssues,
  getSingleIssue,
  updateIssueStatus,
  getAllLiveIssues,
  getAICategorization
} = require('../controllers/employeeIssue.controller');

const { employeeAuthCheck } = require('../middlewares/employeeAuthCheck');

router.post('/issue/create', employeeAuthCheck, createIssue);
// router.get('/issues', employeeAuthCheck, getEmployeeIssues);
router.get('/live', employeeAuthCheck, getAllLiveIssues);
router.get('/', employeeAuthCheck, getEmployeeIssues);
router.get('/issue/:id', employeeAuthCheck, getSingleIssue);
router.patch("/issue/:issueId/status", employeeAuthCheck, updateIssueStatus);
router.post('/categorize', employeeAuthCheck, getAICategorization);


module.exports = router;

