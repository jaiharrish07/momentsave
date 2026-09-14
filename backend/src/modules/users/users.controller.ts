import { Request, Response, NextFunction } from 'express';
import { parseBigIntParam } from '../../utils/params';
import * as usersService from './users.service';

/**
 * POST /api/team-members
 * Admin creates a team member account.
 */
export async function createTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    const teamMember = await usersService.createTeamMember(req.body);
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
 * POST /api/team-members/:teamMemberId/reset-password
 * Admin resets a team member's password.
 */
export async function resetTeamMemberPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const teamMemberId = parseBigIntParam(req.params.teamMemberId, 'teamMemberId');
    const newPassword = req.body.new_password as string;

    await usersService.resetTeamMemberPassword(teamMemberId, newPassword);

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
