import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin role
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

    // Verify campaign exists
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, flyer_url")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaña no encontrada" },
        { status: 404 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("flyer") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa JPEG, PNG o WebP." },
        { status: 400 },
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB." },
        { status: 400 },
      );
    }

    // Use service role client for storage operations
    const serviceClient = createServiceRoleClient();

    // Delete old flyer if exists
    if (campaign.flyer_url) {
      const oldPath = extractStoragePath(campaign.flyer_url);
      if (oldPath) {
        await serviceClient.storage.from("campaign-flyers").remove([oldPath]);
      }
    }

    // Determine file extension
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const timestamp = Date.now();
    const storagePath = `${id}/flyer-${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from("campaign-flyers")
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

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from("campaign-flyers")
      .getPublicUrl(storagePath);

    const flyerUrl = urlData.publicUrl;

    // Update campaign record
    const { error: updateError } = await serviceClient
      .from("campaigns")
      .update({ flyer_url: flyerUrl })
      .eq("id", id);

    if (updateError) {
      console.error("Campaign update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json({ flyer_url: flyerUrl });
  } catch (err) {
    console.error("Flyer upload error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin role
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

    // Fetch campaign
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, flyer_url")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaña no encontrada" },
        { status: 404 },
      );
    }

    if (!campaign.flyer_url) {
      return NextResponse.json({ success: true });
    }

    const serviceClient = createServiceRoleClient();

    // Delete from storage
    const storagePath = extractStoragePath(campaign.flyer_url);
    if (storagePath) {
      await serviceClient.storage.from("campaign-flyers").remove([storagePath]);
    }

    // Update campaign
    const { error: updateError } = await serviceClient
      .from("campaigns")
      .update({ flyer_url: null })
      .eq("id", id);

    if (updateError) {
      console.error("Campaign update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Flyer delete error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * Extract the storage path from a Supabase public URL.
 * URL format: https://<project>.supabase.co/storage/v1/object/public/campaign-flyers/<path>
 */
function extractStoragePath(url: string): string | null {
  const marker = "/storage/v1/object/public/campaign-flyers/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}
