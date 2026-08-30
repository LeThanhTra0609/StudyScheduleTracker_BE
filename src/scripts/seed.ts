import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { connectDB } from '../config/db';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';
import { Location } from '../models/Location.model';
import { Schedule } from '../models/Schedule.model';
import { Attendance } from '../models/Attendance.model';
import { Payment } from '../models/Payment.model';

const seedData = async () => {
  try {
    await connectDB();
    console.log('🧹 Clearing old data...');
    await Promise.all([
      User.deleteMany({}),
      Subject.deleteMany({}),
      Location.deleteMany({}),
      Schedule.deleteMany({}),
      Attendance.deleteMany({}),
      Payment.deleteMany({}),
    ]);

    console.log('👤 Creating sample user...');
    const passwordHash = await bcrypt.hash('123456', 12);
    const user = await User.create({
      name: 'Nguyen Van A',
      email: 'demo@example.com',
      passwordHash,
      notificationPreferences: {
        reminderTimes: [15, 30],
        emailNotifications: false,
      },
    });

    console.log('📚 Creating sample subjects...');
    const [subMobile, subSE, subEng] = await Subject.insertMany([
      {
        userId: user._id,
        name: 'Lập trình Di động',
        code: 'MOB101',
        teacher: 'ThS. Nguyen Van B',
        color: '#1677ff',
        description: 'React Native & Flutter',
      },
      {
        userId: user._id,
        name: 'Kỹ thuật Phần mềm',
        code: 'SWE201',
        teacher: 'TS. Tran Van C',
        color: '#52c41a',
        description: 'Quy trình Agile / Scrum',
      },
      {
        userId: user._id,
        name: 'Tiếng Anh Giao tiếp (Học thêm)',
        code: 'ENG301',
        teacher: 'Mr. David',
        color: '#722ed1',
        description: 'Luyện IELTS & Giao tiếp',
      },
    ]);

    console.log('📍 Creating sample locations...');
    const [locA101, locB202, locCenter] = await Location.insertMany([
      {
        userId: user._id,
        name: 'Phòng A101 - Cơ sở 1',
        address: '227 Nguyễn Văn Cừ, Quận 5',
        mapLink: 'https://maps.google.com',
      },
      {
        userId: user._id,
        name: 'Phòng B202 - Cơ sở 2',
        address: 'Linh Trung, Thủ Đức',
      },
      {
        userId: user._id,
        name: 'Trung tâm Ngoại ngữ Talk & Write',
        address: '123 Cách Mạng Tháng 8, Quận 3',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
      },
    ]);

    console.log('📅 Creating sample schedules...');
    const today = dayjs();

    const sched1 = await Schedule.create({
      userId: user._id,
      subjectId: subMobile._id,
      locationId: locA101._id,
      type: 'ACADEMIC',
      date: today.toDate(),
      startTime: '07:30',
      endTime: '09:30',
      learningMethod: 'OFFLINE',
      teacher: 'ThS. Nguyen Van B',
      status: 'UPCOMING',
    });

    const sched2 = await Schedule.create({
      userId: user._id,
      subjectId: subSE._id,
      locationId: locB202._id,
      type: 'ACADEMIC',
      date: today.toDate(),
      startTime: '13:00',
      endTime: '15:00',
      learningMethod: 'OFFLINE',
      teacher: 'TS. Tran Van C',
      status: 'UPCOMING',
    });

    const schedExtra = await Schedule.create({
      userId: user._id,
      subjectId: subEng._id,
      locationId: locCenter._id,
      type: 'EXTRA_CLASS',
      date: today.toDate(),
      startTime: '18:00',
      endTime: '20:00',
      learningMethod: 'OFFLINE',
      teacher: 'Mr. David',
      status: 'UPCOMING',
      tuition: {
        enabled: true,
        paymentMethod: 'PER_SESSION',
        pricePerSession: 150000,
        chargeOnAbsent: false,
      },
    });

    console.log('✅ Creating sample attendance record...');
    await Attendance.create({
      scheduleId: sched1._id,
      userId: user._id,
      date: today.subtract(1, 'day').toDate(),
      status: 'COMPLETED',
      durationMinutes: 120,
      markedAt: new Date(),
      notes: 'Học đầy đủ, nộp bài tập',
    });

    console.log('💰 Creating sample payment record...');
    await Payment.create({
      userId: user._id,
      scheduleId: schedExtra._id,
      periodLabel: `Tháng ${today.format('MM/YYYY')}`,
      periodStart: today.startOf('month').toDate(),
      periodEnd: today.endOf('month').toDate(),
      totalSessions: 8,
      totalAmount: 1200000,
      paidAmount: 600000,
      remainingAmount: 600000,
      status: 'PARTIAL',
      transactions: [
        {
          amount: 600000,
          paidAt: today.subtract(3, 'day').toDate(),
          method: 'Chuyển khoản',
          notes: 'Thanh toán đợt 1',
        },
      ],
    });

    console.log('✨ Seed completed successfully!');
    console.log('👉 Demo account:');
    console.log('   Email:    demo@example.com');
    console.log('   Password: 123456');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
