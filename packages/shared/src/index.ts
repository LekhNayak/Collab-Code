export interface User {
    id: string;
    username: string;
    email: string;
}

export interface Workspace {
    id: string;
    name: string;
    ownerId: string;
}
