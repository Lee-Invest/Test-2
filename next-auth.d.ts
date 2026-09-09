import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "TRADER" | "ADMIN" | "SUPER_ADMIN";
      name?: string | null;
      email?: string | null;
    };
  }
}
