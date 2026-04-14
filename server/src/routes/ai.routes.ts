import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { requireAuth } from '../middleware/rbac.js';
import { RecommendationService } from '../services/ai.service.js';

const recommendationService = new RecommendationService();

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth());
  app.get('/recommendations', {
    schema: {
      tags: ['AI'],
      summary: 'Get personalized study recommendations',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(
            Type.Object({
              deckId: Type.String(),
              title: Type.String(),
              reason: Type.String(),
              priority: Type.Number(),
              suggestedCards: Type.Number()
            })
          ),
        }),
      },
    },
    handler: async (request) => {
      const { id: userId } = request.user!;
      const recommendations = await recommendationService.generateRecommendations(userId);
      return { success: true, data: recommendations };
    },
  });

  app.get('/insights', {
    schema: {
      tags: ['AI'],
      summary: 'Get user learning insights',
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            weakTopics: Type.Array(Type.String()),
            strongTopics: Type.Array(Type.String()),
            optimalStudyTime: Type.String(),
            retentionRate: Type.Number()
          }),
        }),
      },
    },
    handler: async (request) => {
      const { id: userId } = request.user!;
      const insights = await recommendationService.generateInsights(userId);
      return { success: true, data: insights };
    },
  });
};
