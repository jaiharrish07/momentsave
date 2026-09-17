import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../../utils/errors';
import { parseBigIntParam } from '../../utils/params';
import * as usersService from './users.service';

/**
 * POST /api/team-members
 * Admin creates a team member account owned by them.
 */
export async function createTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const teamMember = await usersService.createTeamMember(adminId, req.body);
    res.status(201).json({
      data: {
        team_member: teamMember,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/team-members
 * Admin lists their own team members. Optional `?search=` filters by
 * name/email substring.
 */
export async function listTeamMembers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const rawSearch = (req.query as Record<string, unknown>).search;
    const search =
      typeof rawSearch === 'string' && rawSearch.length > 0 ? rawSearch : undefined;

    const teamMembers = await usersService.listMyTeamMembers(adminId, search);
    res.json({ data: { team_members: teamMembers } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/team-members/:teamMemberId/reset-password
 * Admin resets a team member's password. Must own the team member.
 */
export async function resetTeamMemberPassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const teamMemberId = parseBigIntParam(req.params.teamMemberId, 'teamMemberId');
    const newPassword = req.body.new_password as string;

    await usersService.resetTeamMemberPassword(adminId, teamMemberId, newPassword);

    res.status(200).json({
      data: {
        team_member_id: teamMemberId.toString(),
        message: 'Password reset successfully',
      },
    });
  } catch (err) {
    next(err);
  }
}
