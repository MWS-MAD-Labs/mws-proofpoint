"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Loader2, Camera, User, Lock, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    department_name?: string;
    job_title?: string;
}

export default function ProfilePage() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch existing profile
    const { data: profile, isLoading } = useQuery<UserProfile>({
        queryKey: ["profile", session?.user?.id],
        queryFn: async () => {
            const res = await fetch(`/api/profiles?userId=${session?.user?.id}`);
            if (!res.ok) throw new Error("Failed to fetch profile");
            const json = await res.json();
            return json.data;
        },
        enabled: !!session?.user?.id,
    });

    // Profile Update Mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: { full_name: string; avatar_url?: string }) => {
            const res = await fetch("/api/profiles", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update profile");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            toast.success("Profile updated successfully");
        },
        onError: () => {
            toast.error("Failed to update profile");
        },
    });

    // Password Update Mutation
    const updatePasswordMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/auth/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update password");
            return json;
        },
        onSuccess: () => {
            toast.success("Password updated successfully");
            // Reset password form
            passwordForm.reset();
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // Avatar Upload Mutation
    const uploadAvatarMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Failed to upload image");
            return res.json();
        },
        onSuccess: (data) => {
            // After upload, update profile with new URL
            if (profile) {
                updateProfileMutation.mutate({
                    full_name: profile.full_name,
                    avatar_url: data.url
                });
            }
        },
        onError: () => {
            toast.error("Failed to upload image");
        },
    });

    // Example forms setup
    const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm();
    const passwordForm = useForm();

    const onProfileSubmit = (data: any) => {
        updateProfileMutation.mutate({ ...data });
    };

    const onPasswordSubmit = (data: any) => {
        if (data.newPassword !== data.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        updatePasswordMutation.mutate({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadAvatarMutation.mutate(file);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            {/* Profile Photo Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Photo</CardTitle>
                    <CardDescription>Click the image to upload a new photo.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center sm:flex-row gap-6">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Avatar className="w-24 h-24 border-2 border-border group-hover:border-primary transition-colors">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback className="text-2xl">{profile?.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity">
                            <Camera className="w-6 h-6" />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                    {uploadAvatarMutation.isPending && <p className="text-sm text-muted-foreground animate-pulse">Uploading...</p>}
                </CardContent>
            </Card>

            {/* Personal Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your personal details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input
                                id="full_name"
                                defaultValue={profile?.full_name}
                                {...registerProfile("full_name")}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={profile?.email} disabled className="bg-muted" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Input value={profile?.department_name || "-"} disabled className="bg-muted" />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={updateProfileMutation.isPending}>
                                {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Change your password.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                {...passwordForm.register("currentPassword", { required: true })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                {...passwordForm.register("newPassword", { required: true })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                {...passwordForm.register("confirmPassword", { required: true })}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" variant="outline" disabled={updatePasswordMutation.isPending}>
                                {updatePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Password
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
