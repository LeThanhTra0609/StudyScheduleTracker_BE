import { Response } from 'express';
import { Subject } from '../models/Subject.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjects = await Subject.find({ userId: req.userId }).sort({ name: 1 });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found' });
      return;
    }
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
