import { logger, task } from '@trigger.dev/sdk';

export const dashboardExampleTask = task({
  id: 'dashboard-example',
  run: async (payload: { message: string }) => {
    logger.info('Dashboard example task ran', payload);
    return payload;
  },
});
