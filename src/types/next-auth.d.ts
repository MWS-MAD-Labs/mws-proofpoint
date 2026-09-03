import "next-auth";

declare module "next-auth" {
    interface User {
        id: string;
        email: string;
        name?: string | null;
        roles?: string[];
        departmentId?: string | null;
        departmentIds?: string[];
    }

    interface Session {
        user: {
            id: string;
            email: string;
            name?: string | null;
            roles?: string[];
            departmentId?: string | null;
            departmentIds?: string[];
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        roles?: string[];
        departmentId?: string | null;
        departmentIds?: string[];
    }
}
