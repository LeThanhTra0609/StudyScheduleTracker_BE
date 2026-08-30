import { Response } from 'express';
import { Location } from '../models/Location.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const locations = await Location.find({ userId: req.userId }).sort({ name: 1 });
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const createLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const location = await Location.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const location = await Location.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!location) {
      res.status(404).json({ success: false, message: 'Location not found' });
      return;
    }
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const deleteLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const location = await Location.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!location) {
      res.status(404).json({ success: false, message: 'Location not found' });
      return;
    }
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
