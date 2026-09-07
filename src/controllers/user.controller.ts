import { Response } from 'express';
import { User } from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { emitToUser } from '../socket/socket.handler';

// POST /api/users/link-child
// Body: { linkCode: string }
export const linkChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await User.findById(req.userId);
    if (!parent) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      return;
    }

    if (parent.role !== 'PARENT') {
      res.status(403).json({ success: false, message: 'Chỉ tài khoản Phụ huynh mới có thể liên kết học sinh' });
      return;
    }

    const { linkCode } = req.body;
    if (!linkCode) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã kết nối' });
      return;
    }

    const trimmedCode = linkCode.trim().toUpperCase();
    const student = await User.findOne({ linkCode: trimmedCode, role: 'STUDENT' });

    if (!student) {
      res.status(404).json({ success: false, message: 'Mã kết nối không hợp lệ hoặc không tìm thấy học sinh' });
      return;
    }

    if (student._id.toString() === parent._id.toString()) {
      res.status(400).json({ success: false, message: 'Không thể tự liên kết với chính mình' });
      return;
    }

    const isAlreadyLinked = parent.children.some(id => id.toString() === student._id.toString());
    if (isAlreadyLinked) {
      res.status(400).json({ success: false, message: 'Học sinh này đã được liên kết với bạn' });
      return;
    }

    // Add to parent's children
    parent.children.push(student._id);
    await parent.save();

    // Add to student's parents
    if (!student.parents.some(id => id.toString() === parent._id.toString())) {
      student.parents.push(parent._id);
      await student.save();
    }

    // Socket notification to student
    emitToUser(io, student._id.toString(), 'notification:new', {
      type: 'system',
      message: `Phụ huynh "${parent.name}" đã liên kết với tài khoản của bạn!`,
    });

    // Return populated children
    const updatedParent = await User.findById(parent._id).populate('children', '_id name email avatar linkCode');

    res.json({
      success: true,
      message: `Đã liên kết thành công với học sinh ${student.name}`,
      children: updatedParent?.children || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error });
  }
};

// DELETE /api/users/unlink-child/:studentId
export const unlinkChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await User.findById(req.userId);
    if (!parent) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      return;
    }

    const { studentId } = req.params;
    parent.children = parent.children.filter(id => id.toString() !== studentId);
    await parent.save();

    // Also remove from student's parents
    await User.findByIdAndUpdate(studentId, {
      $pull: { parents: parent._id },
    });

    const updatedParent = await User.findById(parent._id).populate('children', '_id name email avatar linkCode');

    res.json({
      success: true,
      message: 'Đã hủy liên kết với học sinh',
      children: updatedParent?.children || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error });
  }
};

// GET /api/users/children
export const getChildren = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await User.findById(req.userId).populate('children', '_id name email avatar linkCode');
    if (!parent) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      return;
    }

    res.json({ success: true, children: parent.children || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error });
  }
};
