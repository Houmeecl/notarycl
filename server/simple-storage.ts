// Sistema de almacenamiento simplificado para desarrollo
// No requiere base de datos externa

export interface SimpleUser {
  id: number;
  username: string;
  password: string;
  email: string;
  fullName: string;
  role: string;
  platform?: string;
  createdAt: Date;
  phone?: string;
  address?: string;
  region?: string;
  comuna?: string;
  businessName?: string;
}

export class SimpleStorage {
  users: SimpleUser[] = [];
  
  constructor() {
    console.log("🗄️ Almacenamiento simple inicializado");
  }
  
  addUser(user: SimpleUser) {
    this.users.push(user);
  }
  
  findUserByUsername(username: string): SimpleUser | undefined {
    return this.users.find(u => u.username === username);
  }
  
  findUserByEmail(email: string): SimpleUser | undefined {
    return this.users.find(u => u.email === email);
  }
  
  findUserById(id: number): SimpleUser | undefined {
    return this.users.find(u => u.id === id);
  }
  
  getAllUsers(): SimpleUser[] {
    return this.users;
  }
  
  getUsersByRole(role: string): SimpleUser[] {
    return this.users.filter(u => u.role === role);
  }
}

export const simpleStorage = new SimpleStorage();