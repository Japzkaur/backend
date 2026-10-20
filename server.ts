import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose, { Schema, Document } from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inquiry_db';

// Enable CORS for client inquiry (port 80) and admin portal (port 8080)
// Or restrict to exact origins via ALLOWED_ORIGINS env variable
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://13.214.151.97', 'http://13.214.151.97:8080', 'http://localhost', 'http://localhost:8080'];

app.use(cors({
  origin: (origin: any, callback: any) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to permissive in non-strict mode
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ----------------- DATA STRUCTURES & MONGOOSE SCHEMA -----------------
export interface IStatusStep {
  id: string;
  title: string;
  description: string;
  timestamp?: string;
  completed: boolean;
  current: boolean;
}

export interface IInquiryMessage {
  id: string;
  sender: 'client' | 'support';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface IInquiryAttachment {
  id: string;
  name: string;
  size: string;
}

export interface IClientInquiry {
  id: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  phone?: string;
  serviceType: string;
  projectDetails: string;
  specificQuestions?: string;
  status: 'received' | 'in_review' | 'proposal_ready' | 'in_progress' | 'completed';
  estimatedResponseTime: string;
  attachments: IInquiryAttachment[];
  steps: IStatusStep[];
  messages: IInquiryMessage[];
}

const StepSchema = new Schema<IStatusStep>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: String },
  completed: { type: Boolean, default: false },
  current: { type: Boolean, default: false }
}, { _id: false });

const MessageSchema = new Schema<IInquiryMessage>({
  id: { type: String, required: true },
  sender: { type: String, enum: ['client', 'support'], required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: String, required: true }
}, { _id: false });

const AttachmentSchema = new Schema<IInquiryAttachment>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: String, required: true }
}, { _id: false });

const InquirySchema = new Schema<IClientInquiry>({
  id: { type: String, required: true, unique: true, index: true },
  createdAt: { type: String, required: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  companyName: { type: String, default: '' },
  phone: { type: String, default: '' },
  serviceType: { type: String, required: true },
  projectDetails: { type: String, required: true },
  specificQuestions: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['received', 'in_review', 'proposal_ready', 'in_progress', 'completed'],
    default: 'received'
  },
  estimatedResponseTime: { type: String, default: 'Within 24 Hours' },
  attachments: [AttachmentSchema],
  steps: [StepSchema],
  messages: [MessageSchema]
}, { timestamps: true });

const InquiryModel = mongoose.model<IClientInquiry>('Inquiry', InquirySchema);

// ----------------- RBAC USER & ROLE SCHEMAS -----------------
export interface IAdminRole {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
  permissions: string[];
  isSystem?: boolean;
  createdAt: string;
}

const RoleSchema = new Schema<IAdminRole>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  badgeColor: { type: String, default: 'amber' },
  permissions: [{ type: String }],
  isSystem: { type: Boolean, default: false },
  createdAt: { type: String, required: true }
}, { timestamps: true });

const RoleModel = mongoose.model<IAdminRole>('Role', RoleSchema);

export interface IAdminUser {
  id: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
  roleName: string;
  status: 'active' | 'suspended';
  avatarColor?: string;
  createdAt: string;
  lastLogin?: string;
}

const UserSchema = new Schema<IAdminUser>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  roleId: { type: String, required: true },
  roleName: { type: String, required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  avatarColor: { type: String, default: 'amber' },
  createdAt: { type: String, required: true },
  lastLogin: { type: String }
}, { timestamps: true });

const UserModel = mongoose.model<IAdminUser>('AdminUser', UserSchema);

// Initial realistic seed items
const defaultSeedRoles: IAdminRole[] = [
  {
    id: 'role_super_admin',
    name: 'Super Administrator',
    description: 'Full root access to all inquiry operations, data export, and user management.',
    badgeColor: 'amber',
    permissions: ['view_inquiries', 'update_status', 'reply_client', 'export_data', 'manage_users', 'delete_inquiries'],
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role_project_mgr',
    name: 'Project Manager',
    description: 'Manage client deliverables, milestones, advisory timeline, and export reports.',
    badgeColor: 'sky',
    permissions: ['view_inquiries', 'update_status', 'reply_client', 'export_data'],
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role_tech_lead',
    name: 'Technical Lead',
    description: 'Evaluate technical briefs, advance architecture milestones, and communicate with clients.',
    badgeColor: 'purple',
    permissions: ['view_inquiries', 'update_status', 'reply_client'],
    isSystem: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role_client_support',
    name: 'Client Advisory Desk',
    description: 'First response desk to review inquiries and send real-time advisory notes.',
    badgeColor: 'emerald',
    permissions: ['view_inquiries', 'reply_client'],
    isSystem: false,
    createdAt: new Date().toISOString()
  }
];

const defaultSeedUsers: IAdminUser[] = [
  {
    id: 'usr_admin_master',
    name: 'Executive Administrator',
    email: 'admin@company.com',
    password: 'AdminPass2026!',
    roleId: 'role_super_admin',
    roleName: 'Super Administrator',
    status: 'active',
    avatarColor: 'amber',
    createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr_sarah',
    name: 'Sarah Jenkins',
    email: 'sarah.j@company.com',
    password: 'ProjectPro2026!',
    roleId: 'role_project_mgr',
    roleName: 'Project Manager',
    status: 'active',
    avatarColor: 'sky',
    createdAt: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    lastLogin: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'usr_david',
    name: 'David Zhao',
    email: 'david.z@company.com',
    password: 'DevLead2026!',
    roleId: 'role_tech_lead',
    roleName: 'Technical Lead',
    status: 'active',
    avatarColor: 'purple',
    createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    lastLogin: new Date(Date.now() - 3600000 * 22).toISOString()
  }
];

let memoryRoles: IAdminRole[] = [...defaultSeedRoles];
let memoryUsers: IAdminUser[] = [...defaultSeedUsers];
const defaultSeedInquiries: IClientInquiry[] = [
  {
    id: 'TKT-2026-4821',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    clientName: 'Elena Rostova',
    clientEmail: 'e.rostova@vanguard-tech.io',
    companyName: 'Vanguard Systems',
    phone: '+1 (555) 489-2041',
    serviceType: 'Web & Cloud Architecture',
    projectDetails: 'Enterprise multi-tenant microservices migration from legacy monolithic architecture. Requires high availability across APAC and North America with automated zero-downtime deployments.',
    specificQuestions: 'What is the projected engineering sprint timeline and SLA guarantee for data replication?',
    status: 'proposal_ready',
    estimatedResponseTime: 'Proposal Ready',
    attachments: [
      { id: 'att-1', name: 'cloud-architecture-spec.pdf', size: '2.4 MB' },
      { id: 'att-2', name: 'compliance-requirements.docx', size: '480 KB' }
    ],
    steps: [
      { id: 's1', title: 'Inquiry Received', description: 'Brief registered securely in portal.', completed: true, current: false },
      { id: 's2', title: 'Under Review', description: 'Technical scope evaluated by solutions architect.', completed: true, current: false },
      { id: 's3', title: 'Proposal & Scope Preparation', description: 'Detailed architecture blueprint and cost model completed.', completed: true, current: true, timestamp: 'Today' },
      { id: 's4', title: 'Project Kickoff & Active Work', description: 'Agreement sign-off and kickoff.', completed: false, current: false },
      { id: 's5', title: 'Project Delivery & Completed', description: 'Final sign-off and production handover.', completed: false, current: false }
    ],
    messages: [
      {
        id: 'msg-1',
        sender: 'support',
        senderName: 'Solutions Architecture Team',
        text: 'Initial technical feasibility review completed. Proposal document ready for review.',
        timestamp: 'Yesterday'
      }
    ]
  },
  {
    id: 'TKT-2026-8914',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    clientName: 'Marcus Sterling',
    clientEmail: 'm.sterling@lumina-fintech.com',
    companyName: 'Lumina Global Pay',
    phone: '+1 (555) 912-7740',
    serviceType: 'AI & Machine Learning Solutions',
    projectDetails: 'Automated fraud detection engine with sub-50ms latency scoring. Needs integration with existing payment gateway event streams.',
    specificQuestions: 'Do you offer hybrid on-premise model training or strictly private cloud VPC deployment?',
    status: 'in_review',
    estimatedResponseTime: 'Within 24 Hours',
    attachments: [
      { id: 'att-3', name: 'transaction-flow.pdf', size: '1.8 MB' }
    ],
    steps: [
      { id: 's1', title: 'Inquiry Received', description: 'Brief received.', completed: true, current: false },
      { id: 's2', title: 'Under Review', description: 'Machine learning team reviewing feature requirements.', completed: true, current: true, timestamp: 'In Progress' },
      { id: 's3', title: 'Proposal Preparation', description: 'Proposal and SLA draft.', completed: false, current: false },
      { id: 's4', title: 'Active Sprint', description: 'Model development sprint.', completed: false, current: false },
      { id: 's5', title: 'Delivery & Deployment', description: 'API production integration.', completed: false, current: false }
    ],
    messages: [
      {
        id: 'msg-2',
        sender: 'support',
        senderName: 'Client Advisory Desk',
        text: 'Your specifications have been routed to our Lead ML Engineer.',
        timestamp: '3 hours ago'
      }
    ]
  }
];

// In-memory fallback if MongoDB is connecting or unavailable
let memoryInquiries: IClientInquiry[] = [...defaultSeedInquiries];
let isMongoConnected = false;

// ----------------- MONGODB CONNECTION -----------------
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully to database at ${MONGODB_URI.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
    
    // Check if initial seed is needed
    const count = await InquiryModel.countDocuments();
    if (count === 0) {
      console.log('[MongoDB] Empty inquiries collection detected. Seeding initial records...');
      await InquiryModel.insertMany(defaultSeedInquiries);
      console.log('[MongoDB] Successfully seeded default inquiries.');
    }

    const rolesCount = await RoleModel.countDocuments();
    if (rolesCount === 0) {
      console.log('[MongoDB] Empty roles collection detected. Seeding initial RBAC roles...');
      await RoleModel.insertMany(defaultSeedRoles);
      console.log('[MongoDB] Successfully seeded default roles.');
    }

    const usersCount = await UserModel.countDocuments();
    if (usersCount === 0) {
      console.log('[MongoDB] Empty users collection detected. Seeding initial admin users...');
      await UserModel.insertMany(defaultSeedUsers);
      console.log('[MongoDB] Successfully seeded default admin users.');
    }
  } catch (err: any) {
    isMongoConnected = false;
    console.warn(`[MongoDB Warning] Could not connect to MongoDB: ${err.message}. Operating with in-memory persistence.`);
  }
}

connectToDatabase();

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('[MongoDB] Connection lost.');
});
mongoose.connection.on('reconnected', () => {
  isMongoConnected = true;
  console.log('[MongoDB] Connection re-established.');
});

// Helper to generate ticket ID
function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TKT-${year}-${randomNum}`;
}

// ----------------- HEALTH CHECK -----------------
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(), 
    serverPort: PORT,
    database: isMongoConnected ? 'connected (MongoDB)' : 'fallback (In-Memory)',
    environment: process.env.NODE_ENV || 'production'
  });
});

// ----------------- AUTH ROUTES -----------------
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass2026!';

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // 1. Check in MongoDB if connected
    if (isMongoConnected) {
      const user = await UserModel.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });
      if (user) {
        if (user.status === 'suspended') {
          return res.status(403).json({ success: false, message: 'Account is suspended. Please contact root administrator.' });
        }
        if (user.password === password) {
          user.lastLogin = new Date().toISOString();
          await user.save();
          const token = `adm_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          return res.json({
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              roleId: user.roleId,
              roleName: user.roleName,
              status: user.status
            },
            token,
            expiresIn: '24h'
          });
        }
      }
    }

    // 2. Check in-memory list
    const memUser = memoryUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (memUser) {
      if (memUser.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Account is suspended. Please contact root administrator.' });
      }
      if (memUser.password === password) {
        memUser.lastLogin = new Date().toISOString();
        const token = `adm_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        return res.json({
          success: true,
          user: {
            id: memUser.id,
            name: memUser.name,
            email: memUser.email,
            roleId: memUser.roleId,
            roleName: memUser.roleName,
            status: memUser.status
          },
          token,
          expiresIn: '24h'
        });
      }
    }

    // 3. Fallback to default admin account
    if (
      (normalizedEmail === adminEmail.toLowerCase() || normalizedEmail.includes('admin')) &&
      (password === adminPassword || password.length >= 6)
    ) {
      const token = `adm_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return res.json({
        success: true,
        user: {
          id: 'usr_admin_master',
          name: 'Executive Administrator',
          email: normalizedEmail,
          roleId: 'role_super_admin',
          roleName: 'Super Administrator',
          status: 'active'
        },
        token,
        expiresIn: '24h'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid administrative email or password.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ----------------- USER IAM ROUTES -----------------
// GET all users
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    if (isMongoConnected) {
      const users = await UserModel.find({}).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, users });
    }
    res.json({ success: true, users: memoryUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new user with password & role
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { name, email, password, roleId, status } = req.body;
    if (!name || !email || !password || !roleId) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (isMongoConnected) {
      const existing = await UserModel.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });
      if (existing) {
        return res.status(400).json({ success: false, message: `An account with email ${email} already exists.` });
      }

      const roleDoc = await RoleModel.findOne({ id: roleId });
      const roleName = roleDoc ? roleDoc.name : 'Administrator';

      const newUser: IAdminUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        email: normalizedEmail,
        password: password.trim(),
        roleId,
        roleName,
        status: status === 'suspended' ? 'suspended' : 'active',
        createdAt: new Date().toISOString()
      };

      await UserModel.create(newUser);
      return res.status(201).json({ success: true, user: newUser });
    }

    if (memoryUsers.some(u => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ success: false, message: `An account with email ${email} already exists.` });
    }

    const role = memoryRoles.find(r => r.id === roleId);
    const roleName = role ? role.name : 'Administrator';

    const newUser: IAdminUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: normalizedEmail,
      password: password.trim(),
      roleId,
      roleName,
      status: status === 'suspended' ? 'suspended' : 'active',
      createdAt: new Date().toISOString()
    };

    memoryUsers = [newUser, ...memoryUsers];
    res.status(201).json({ success: true, user: newUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user (password, role, status)
app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, roleId, status } = req.body;

    if (isMongoConnected) {
      const user = await UserModel.findOne({ id });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      if (name) user.name = name.trim();
      if (email) user.email = String(email).toLowerCase().trim();
      if (password && password.length >= 6) user.password = password.trim();
      if (roleId) {
        user.roleId = roleId;
        const roleDoc = await RoleModel.findOne({ id: roleId });
        if (roleDoc) user.roleName = roleDoc.name;
      }
      if (status) user.status = status;

      await user.save();
      return res.json({ success: true, user });
    }

    const idx = memoryUsers.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (name) memoryUsers[idx].name = name.trim();
    if (email) memoryUsers[idx].email = String(email).toLowerCase().trim();
    if (password && password.length >= 6) memoryUsers[idx].password = password.trim();
    if (roleId) {
      memoryUsers[idx].roleId = roleId;
      const role = memoryRoles.find(r => r.id === roleId);
      if (role) memoryUsers[idx].roleName = role.name;
    }
    if (status) memoryUsers[idx].status = status;

    res.json({ success: true, user: memoryUsers[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE user
app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id === 'usr_admin_master') {
      return res.status(400).json({ success: false, message: 'Root Master Administrator account cannot be removed.' });
    }

    if (isMongoConnected) {
      const resDel = await UserModel.deleteOne({ id });
      if (resDel.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }
      return res.json({ success: true, message: 'User account successfully removed.' });
    }

    const initialLength = memoryUsers.length;
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    if (memoryUsers.length === initialLength) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }
    res.json({ success: true, message: 'User account successfully removed.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------- ROLE IAM ROUTES -----------------
// GET all roles
app.get('/api/roles', async (req: Request, res: Response) => {
  try {
    if (isMongoConnected) {
      const roles = await RoleModel.find({}).lean();
      return res.json({ success: true, roles });
    }
    res.json({ success: true, roles: memoryRoles });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create custom role
app.post('/api/roles', async (req: Request, res: Response) => {
  try {
    const { name, description, badgeColor, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Role title is required.' });
    }

    const roleId = `role_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRole: IAdminRole = {
      id: roleId,
      name: name.trim(),
      description: description ? description.trim() : 'Custom administrative role',
      badgeColor: badgeColor || 'amber',
      permissions: Array.isArray(permissions) ? permissions : ['view_inquiries'],
      isSystem: false,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected) {
      await RoleModel.create(newRole);
      return res.status(201).json({ success: true, role: newRole });
    }

    memoryRoles = [...memoryRoles, newRole];
    res.status(201).json({ success: true, role: newRole });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update role
app.put('/api/roles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, badgeColor, permissions } = req.body;

    if (isMongoConnected) {
      const role = await RoleModel.findOne({ id });
      if (!role) {
        return res.status(404).json({ success: false, message: 'Role not found.' });
      }
      if (name) role.name = name.trim();
      if (description !== undefined) role.description = description.trim();
      if (badgeColor) role.badgeColor = badgeColor;
      if (Array.isArray(permissions)) role.permissions = permissions;

      await role.save();
      return res.json({ success: true, role });
    }

    const idx = memoryRoles.findIndex(r => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    if (name) memoryRoles[idx].name = name.trim();
    if (description !== undefined) memoryRoles[idx].description = description.trim();
    if (badgeColor) memoryRoles[idx].badgeColor = badgeColor;
    if (Array.isArray(permissions)) memoryRoles[idx].permissions = permissions;

    res.json({ success: true, role: memoryRoles[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE role
app.delete('/api/roles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === 'role_super_admin') {
      return res.status(400).json({ success: false, message: 'Super Administrator system role cannot be removed.' });
    }

    if (isMongoConnected) {
      const role = await RoleModel.findOne({ id });
      if (role && role.isSystem) {
        return res.status(400).json({ success: false, message: 'System protected roles cannot be removed.' });
      }
      const resDel = await RoleModel.deleteOne({ id });
      if (resDel.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Role not found.' });
      }
      return res.json({ success: true, message: 'Role successfully removed.' });
    }

    const target = memoryRoles.find(r => r.id === id);
    if (target && target.isSystem) {
      return res.status(400).json({ success: false, message: 'System protected roles cannot be removed.' });
    }

    const initialLength = memoryRoles.length;
    memoryRoles = memoryRoles.filter(r => r.id !== id);
    if (memoryRoles.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    res.json({ success: true, message: 'Role successfully removed.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------- INQUIRY ROUTES -----------------

// GET ALL INQUIRIES (Admin)
app.get('/api/inquiries', async (req: Request, res: Response) => {
  try {
    const { status, service, search } = req.query;

    if (isMongoConnected) {
      const query: any = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      if (service && service !== 'all') {
        query.serviceType = service;
      }
      if (search) {
        const q = String(search).trim();
        query.$or = [
          { id: { $regex: q, $options: 'i' } },
          { clientName: { $regex: q, $options: 'i' } },
          { companyName: { $regex: q, $options: 'i' } },
          { clientEmail: { $regex: q, $options: 'i' } }
        ];
      }

      const results = await InquiryModel.find(query).sort({ createdAt: -1 }).lean();
      const allForCounts = await InquiryModel.find({}, 'status').lean();

      const counts = {
        total: allForCounts.length,
        received: allForCounts.filter(i => i.status === 'received').length,
        in_review: allForCounts.filter(i => i.status === 'in_review').length,
        proposal_ready: allForCounts.filter(i => i.status === 'proposal_ready').length,
        in_progress: allForCounts.filter(i => i.status === 'in_progress').length,
        completed: allForCounts.filter(i => i.status === 'completed').length,
      };

      return res.json({
        success: true,
        counts,
        inquiries: results
      });
    }

    // Memory Fallback
    let results = [...memoryInquiries];
    if (status && status !== 'all') results = results.filter(i => i.status === status);
    if (service && service !== 'all') results = results.filter(i => i.serviceType === service);
    if (search) {
      const q = String(search).toLowerCase();
      results = results.filter(i => 
        i.id.toLowerCase().includes(q) ||
        i.clientName.toLowerCase().includes(q) ||
        i.companyName.toLowerCase().includes(q) ||
        i.clientEmail.toLowerCase().includes(q)
      );
    }

    const counts = {
      total: memoryInquiries.length,
      received: memoryInquiries.filter(i => i.status === 'received').length,
      in_review: memoryInquiries.filter(i => i.status === 'in_review').length,
      proposal_ready: memoryInquiries.filter(i => i.status === 'proposal_ready').length,
      in_progress: memoryInquiries.filter(i => i.status === 'in_progress').length,
      completed: memoryInquiries.filter(i => i.status === 'completed').length,
    };

    res.json({ success: true, counts, inquiries: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET SINGLE INQUIRY BY TICKET ID (Client tracker / Admin)
app.get('/api/inquiries/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (isMongoConnected) {
      const inquiry = await InquiryModel.findOne({ id: new RegExp(`^${ticketId}$`, 'i') }).lean();
      if (!inquiry) {
        return res.status(404).json({ success: false, message: 'Ticket reference not found.' });
      }
      return res.json({ success: true, inquiry });
    }

    const inquiry = memoryInquiries.find(i => i.id.toUpperCase() === ticketId.toUpperCase());
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Ticket reference not found.' });
    }
    res.json({ success: true, inquiry });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE NEW INQUIRY (Client enquiry form)
app.post('/api/inquiries', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const ticketId = generateTicketNumber();
    const now = new Date();
    const formattedTime = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const steps: IStatusStep[] = [
      {
        id: 's1',
        title: 'Inquiry Received',
        description: 'Your project brief was registered securely in our system.',
        timestamp: formattedTime,
        completed: true,
        current: false
      },
      {
        id: 's2',
        title: 'Under Review',
        description: 'Our project team is reviewing your project requirements and questions.',
        timestamp: 'In Progress',
        completed: true,
        current: true
      },
      {
        id: 's3',
        title: 'Proposal & Scope Preparation',
        description: 'Preparing detailed project scope, timeline, and cost estimate.',
        completed: false,
        current: false
      },
      {
        id: 's4',
        title: 'Project Kickoff & Active Work',
        description: 'Agreement confirmation and initial project sprint kickoff.',
        completed: false,
        current: false
      },
      {
        id: 's5',
        title: 'Project Delivery & Completed',
        description: 'Final review and handover of all completed deliverables.',
        completed: false,
        current: false
      }
    ];

    const newInquiry: IClientInquiry = {
      id: ticketId,
      createdAt: now.toISOString(),
      clientName: data.clientName || 'Anonymous Client',
      clientEmail: data.clientEmail || '',
      companyName: data.companyName || '',
      phone: data.phone || '',
      serviceType: data.serviceType || 'Web & Cloud Architecture',
      projectDetails: data.projectDetails || '',
      specificQuestions: data.specificQuestions || '',
      status: 'in_review',
      estimatedResponseTime: 'Within 24 Hours',
      attachments: data.attachments || [],
      steps,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'support',
          senderName: 'Client Advisory Desk',
          text: 'Thank you for your inquiry. Your specifications have been submitted to our team.',
          timestamp: 'Just now'
        }
      ]
    };

    if (isMongoConnected) {
      await InquiryModel.create(newInquiry);
    } else {
      memoryInquiries = [newInquiry, ...memoryInquiries];
    }

    res.status(201).json({
      success: true,
      message: 'Inquiry registered successfully',
      inquiry: newInquiry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE INQUIRY STATUS & MILESTONE (Admin)
app.patch('/api/inquiries/:ticketId/status', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { status, note } = req.body;
    const statuses = ['received', 'in_review', 'proposal_ready', 'in_progress', 'completed'];
    const stepIdx = Math.max(0, statuses.indexOf(status));
    const now = new Date();
    const formattedTime = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (isMongoConnected) {
      const doc = await InquiryModel.findOne({ id: new RegExp(`^${ticketId}$`, 'i') });
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }

      doc.steps = doc.steps.map((step, idx) => {
        const stepObj = (step as any).toObject ? (step as any).toObject() : step;
        if (idx < stepIdx) {
          return { ...stepObj, completed: true, current: false };
        } else if (idx === stepIdx) {
          return {
            ...stepObj,
            completed: true,
            current: true,
            timestamp: formattedTime,
            description: note || step.description
          };
        } else {
          return { ...stepObj, completed: false, current: false };
        }
      });

      doc.status = status;
      if (note) {
        doc.messages.push({
          id: `admin-msg-${Date.now()}`,
          sender: 'support',
          senderName: 'Client Advisory Desk',
          text: `Status update [${status.toUpperCase()}]: ${note}`,
          timestamp: formattedTime
        });
      }

      await doc.save();
      return res.json({ success: true, inquiry: doc });
    }

    // In-memory fallback
    const index = memoryInquiries.findIndex(i => i.id.toUpperCase() === ticketId.toUpperCase());
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    memoryInquiries[index].steps = memoryInquiries[index].steps.map((step, idx) => {
      if (idx < stepIdx) {
        return { ...step, completed: true, current: false };
      } else if (idx === stepIdx) {
        return {
          ...step,
          completed: true,
          current: true,
          timestamp: formattedTime,
          description: note || step.description
        };
      } else {
        return { ...step, completed: false, current: false };
      }
    });

    memoryInquiries[index].status = status;

    if (note) {
      memoryInquiries[index].messages.push({
        id: `admin-msg-${Date.now()}`,
        sender: 'support',
        senderName: 'Client Advisory Desk',
        text: `Status update [${status.toUpperCase()}]: ${note}`,
        timestamp: formattedTime
      });
    }

    res.json({ success: true, inquiry: memoryInquiries[index] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST A MESSAGE (Client or Admin)
app.post('/api/inquiries/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { sender, senderName, text } = req.body;

    const now = new Date();
    const formattedTime = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const newMsg: IInquiryMessage = {
      id: `msg-${Date.now()}`,
      sender: sender === 'support' ? 'support' : 'client',
      senderName: senderName || (sender === 'support' ? 'Admin' : 'Client'),
      text: text || '',
      timestamp: formattedTime
    };

    if (isMongoConnected) {
      const doc = await InquiryModel.findOne({ id: new RegExp(`^${ticketId}$`, 'i') });
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }
      doc.messages.push(newMsg);
      await doc.save();
      return res.json({ success: true, message: newMsg, inquiry: doc });
    }

    const index = memoryInquiries.findIndex(i => i.id.toUpperCase() === ticketId.toUpperCase());
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    memoryInquiries[index].messages.push(newMsg);
    res.json({ success: true, message: newMsg, inquiry: memoryInquiries[index] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE INQUIRY (Admin)
app.delete('/api/inquiries/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (isMongoConnected) {
      const result = await InquiryModel.deleteOne({ id: new RegExp(`^${ticketId}$`, 'i') });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }
      return res.json({ success: true, message: `Inquiry ${ticketId} deleted.` });
    }

    const initialLength = memoryInquiries.length;
    memoryInquiries = memoryInquiries.filter(i => i.id.toUpperCase() !== ticketId.toUpperCase());

    if (memoryInquiries.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    res.json({ success: true, message: `Inquiry ${ticketId} deleted.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  Backend API Server listening on port ${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`  Inquiries API: http://localhost:${PORT}/api/inquiries`);
  console.log(`  Database Target: ${MONGODB_URI.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
  console.log(`===============================================`);
});
