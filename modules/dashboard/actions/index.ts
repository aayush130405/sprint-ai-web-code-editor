//this file gets the existing playground data for the current user if any

"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

export const getAllPlaygroundForUser = async () => {
  const user = await getCurrentUser();

  try {
    const playground = await db.playground.findMany({
      where: {
        userId: user?.id,
      },
      include: {
        user: true,
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
  description?: string;
}) => {
  const user = await getCurrentUser();

  const { title, template, description } = data;

  try {
    const playground = await db.playground.create({
      data: {
        title: title,
        description: description,
        template: template,
        userId: user?.id!,
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const deleteProjectById = async (id: string) => {
  try {
    await db.playground.delete({ where: { id } });
    revalidatePath("/dashboard"); //will be used so that page automatically refreshes to show the updated data rather than doing it manually
  } catch (error) {
    console.log(error);
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string },
) => {
  try {
    await db.playground.update({
      where: {
        id,
      },
      data: data,
    });

    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const duplicateProjectById = async (id: string) => {
  try {
    const originalPlayground = await db.playground.findUnique({
      where: {
        id,
      },
      //todo add template files
    });
    if (!originalPlayground) {
      throw new Error("Original playground not found!");
    }

    const duplicatedPlayground = await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId: originalPlayground.userId,
        //todo add template files
      },
    });
    revalidatePath("/dashboard");
    return duplicatedPlayground;
  } catch (error) {
    console.log(error);
  }
};
