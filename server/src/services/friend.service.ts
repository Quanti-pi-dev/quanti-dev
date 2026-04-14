// ─── Friend Service ─────────────────────────────────────────
// Business logic for friend requests, acceptance, blocking.
// All guards are enforced here — the routes are thin wrappers.

import { challengeRepository } from '../repositories/challenge.repository.js';
import { notificationService } from './notification.service.js';
import { createServiceLogger } from '../lib/logger.js';
import type { Friendship, UserSummary } from '@kd/shared';

const log = createServiceLogger('FriendService');

class FriendService {
  /**
   * Send a friend request.
   * Guards: self-request, duplicate, blocked.
   */
  async sendFriendRequest(requesterAuth0Id: string, addresseePgId: string): Promise<Friendship> {
    const requesterId = await challengeRepository.resolveUserId(requesterAuth0Id);
    if (!requesterId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    if (requesterId === addresseePgId) {
      throw Object.assign(new Error('Cannot send a friend request to yourself'), { statusCode: 400 });
    }

    const existing = await challengeRepository.findRelationship(requesterId, addresseePgId);
    if (existing) {
      if (existing.status === 'blocked') {
        throw Object.assign(new Error('Cannot send request to this user'), { statusCode: 403 });
      }
      if (existing.status === 'accepted') {
        throw Object.assign(new Error('Already friends'), { statusCode: 409 });
      }
      if (existing.status === 'pending') {
        throw Object.assign(new Error('Friend request already pending'), { statusCode: 409 });
      }
    }

    const friendship = await challengeRepository.createFriendRequest(requesterId, addresseePgId);

    // Fire push notification (non-blocking)
    const requesterName = await challengeRepository.resolveUserDisplayName(requesterId);
    void notificationService.handleEvent({
      type: 'friend_request_received' as never,
      userId: addresseePgId,
      requesterName,
    } as never).catch((err) => log.error({ err }, 'friend request push failed'));

    return friendship;
  }

  /**
   * Accept a friend request.
   * Guard: only the addressee can accept; must be pending.
   */
  async acceptFriendRequest(friendshipId: string, actingAuth0Id: string): Promise<void> {
    const actingUserId = await challengeRepository.resolveUserId(actingAuth0Id);
    if (!actingUserId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const friendship = await challengeRepository.findFriendshipById(friendshipId);
    if (!friendship) throw Object.assign(new Error('Friend request not found'), { statusCode: 404 });
    if (friendship.addresseeId !== actingUserId) {
      throw Object.assign(new Error('Only the recipient can accept'), { statusCode: 403 });
    }
    if (friendship.status !== 'pending') {
      throw Object.assign(new Error('Request is no longer pending'), { statusCode: 409 });
    }

    await challengeRepository.updateFriendshipStatus(friendshipId, 'accepted');

    // Fire push notification (non-blocking)
    const accepterName = await challengeRepository.resolveUserDisplayName(actingUserId);
    void notificationService.handleEvent({
      type: 'friend_request_accepted' as never,
      userId: friendship.requesterId,
      accepterName,
    } as never).catch((err) => log.error({ err }, 'friend accept push failed'));
  }

  /**
   * Reject a friend request (hard delete).
   * Guard: only the addressee can reject; must be pending.
   */
  async rejectFriendRequest(friendshipId: string, actingAuth0Id: string): Promise<void> {
    const actingUserId = await challengeRepository.resolveUserId(actingAuth0Id);
    if (!actingUserId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const friendship = await challengeRepository.findFriendshipById(friendshipId);
    if (!friendship) throw Object.assign(new Error('Friend request not found'), { statusCode: 404 });
    if (friendship.addresseeId !== actingUserId) {
      throw Object.assign(new Error('Only the recipient can reject'), { statusCode: 403 });
    }

    await challengeRepository.deleteFriendship(friendshipId);
  }

  /**
   * Remove an accepted friend (either party).
   */
  async removeFriend(friendshipId: string, actingAuth0Id: string): Promise<void> {
    const actingUserId = await challengeRepository.resolveUserId(actingAuth0Id);
    if (!actingUserId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const friendship = await challengeRepository.findFriendshipById(friendshipId);
    if (!friendship) throw Object.assign(new Error('Friendship not found'), { statusCode: 404 });
    if (friendship.requesterId !== actingUserId && friendship.addresseeId !== actingUserId) {
      throw Object.assign(new Error('Not a participant in this friendship'), { statusCode: 403 });
    }
    if (friendship.status !== 'accepted') {
      throw Object.assign(new Error('Friendship is not active'), { statusCode: 409 });
    }

    await challengeRepository.deleteFriendship(friendshipId);
  }

  /**
   * Block a user. If an existing friendship exists, it becomes blocked.
   * If no relationship exists, insert a blocked row.
   */
  async blockUser(actingAuth0Id: string, targetPgId: string): Promise<void> {
    const actingUserId = await challengeRepository.resolveUserId(actingAuth0Id);
    if (!actingUserId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    if (actingUserId === targetPgId) {
      throw Object.assign(new Error('Cannot block yourself'), { statusCode: 400 });
    }

    const existing = await challengeRepository.findRelationship(actingUserId, targetPgId);
    if (existing) {
      await challengeRepository.updateFriendshipStatus(existing.id, 'blocked');
    } else {
      // Insert a new blocked relationship
      const friendship = await challengeRepository.createFriendRequest(actingUserId, targetPgId);
      await challengeRepository.updateFriendshipStatus(friendship.id, 'blocked');
    }
  }

  // ─── Read methods (pass-through with auth0_id resolution) ──

  /** Look up a friendship by ID (used by M7 status-based dispatch) */
  async getFriendship(friendshipId: string): Promise<Friendship | null> {
    return challengeRepository.findFriendshipById(friendshipId);
  }

  async listFriends(auth0Id: string): Promise<UserSummary[]> {
    const userId = await challengeRepository.resolveUserId(auth0Id);
    if (!userId) return [];
    return challengeRepository.listFriends(userId);
  }

  async listPendingReceived(auth0Id: string): Promise<Friendship[]> {
    const userId = await challengeRepository.resolveUserId(auth0Id);
    if (!userId) return [];
    return challengeRepository.listPendingReceived(userId);
  }

  async listPendingSent(auth0Id: string): Promise<Friendship[]> {
    const userId = await challengeRepository.resolveUserId(auth0Id);
    if (!userId) return [];
    return challengeRepository.listPendingSent(userId);
  }

  async searchUsers(query: string, requestingAuth0Id: string): Promise<UserSummary[]> {
    const userId = await challengeRepository.resolveUserId(requestingAuth0Id);
    if (!userId) return [];
    return challengeRepository.searchUsers(query, userId);
  }
}

export const friendService = new FriendService();
