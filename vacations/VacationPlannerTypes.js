/**
 * VacationPlannerTypes.gs — JSDoc contracts for the vacation planner.
 */

/**
 * @typedef {Object} VacationRequest
 * @property {string} fml
 * @property {number} vacationNumber
 * @property {Date|string} desiredStart
 * @property {number} durationDays
 * @property {number} searchWindowBefore
 * @property {number} searchWindowAfter
 * @property {string=} travel
 */

/**
 * @typedef {Object} VacationOption
 * @property {number} rank
 * @property {string} fml
 * @property {number} vacationNumber
 * @property {Date} startDate
 * @property {Date} endDate
 * @property {number} days
 * @property {number} score
 * @property {"VALID"|"COMPROMISE"|"REJECTED"} status
 * @property {string} explanation
 * @property {boolean} selectedForApply
 * @property {string=} travel
 */
