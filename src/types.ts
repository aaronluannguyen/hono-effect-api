// User types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  username: string;
  email: string;
  displayName: string;
  bio?: string;
}

export interface UpdateUserInput {
  email?: string;
  displayName?: string;
  bio?: string;
}

// Post types
export interface Post {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePostInput {
  userId: string;
  content: string;
}

export interface UpdatePostInput {
  content?: string;
}
