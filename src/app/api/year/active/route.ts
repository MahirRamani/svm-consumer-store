import connectDB from '@/lib/config/db';
import { YearConfig } from '@/models/YearConfig';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';

const getActiveYearHandler = async () => {
  await connectDB();

  const config = await YearConfig.findOne({ isActive: true })
    .select('currentYear yearStartDate yearEndDate isYearLocked')
    .lean();

  // null is a valid response — UI uses it to decide the mode
  return successResponse(config ?? null, 200);
};

export const GET = withErrorHandler(getActiveYearHandler);