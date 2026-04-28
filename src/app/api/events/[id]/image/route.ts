import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export const maxDuration = 10;

const STORAGE_BUCKET = "event-images";
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

/** POST /api/events/[id]/image — upload cover image (multipart, field 'image') */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores." },
        { status: 403 },
      );
    }

    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("id, image_url")
      .eq("id", id)
      .single();
    if (fetchError || !event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo" },
        { status: 400 },
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa JPEG, PNG o WebP." },
        { status: 400 },
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB." },
        { status: 400 },
      );
    }

    const service = createServiceRoleClient();

    // Remove previous image if any
    if (event.image_url) {
      const oldPath = extractStoragePath(event.image_url);
      if (oldPath) {
        await service.storage.from(STORAGE_BUCKET).remove([oldPath]);
      }
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const storagePath = `${id}/cover-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await service.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Error al subir el archivo" },
        { status: 500 },
      );
    }

    const { data: urlData } = service.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;

    const { error: updateError } = await service
      .from("events")
      .update({ image_url: imageUrl })
      .eq("id", id);
    if (updateError) {
      console.error("Event update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (err) {
    console.error("Event image upload error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** DELETE /api/events/[id]/image — remove cover image */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores." },
        { status: 403 },
      );
    }

    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("id, image_url")
      .eq("id", id)
      .single();
    if (fetchError || !event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 },
      );
    }

    if (!event.image_url) {
      return NextResponse.json({ success: true });
    }

    const service = createServiceRoleClient();
    const storagePath = extractStoragePath(event.image_url);
    if (storagePath) {
      await service.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }

    const { error: updateError } = await service
      .from("events")
      .update({ image_url: null })
      .eq("id", id);
    if (updateError) {
      console.error("Event update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Event image delete error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

function extractStoragePath(url: string): string | null {
  const idx = url.indexOf(PUBLIC_PATH_MARKER);
  if (idx === -1) return null;
  return url.substring(idx + PUBLIC_PATH_MARKER.length);
}
