// app/api/sub-products/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

// Utility function to upload buffer to Cloudinary
async function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  folder: string = "svm-consumer-store"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: folder,
        resource_type: "image",
        transformation: {
          quality: "auto:best",
          fetch_format: "auto",
        },
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
          });
        } else {
          reject(new Error("Upload failed: No result returned"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const customImageName = formData.get("imageName") as string | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file provided"
        },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Please upload JPEG, PNG, WebP, or GIF."
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File size too large. Maximum size is 5MB."
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    let baseFileName: string;

    if (customImageName?.trim()) {
      // Sanitize custom name
      baseFileName = customImageName
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9\-_.]/g, '')
        .replace(/-+/g, '_');
    } else {
      // Use original filename without extension
      baseFileName = file.name.replace(/\.[^/.]+$/, "");
    }

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();
    const publicId = `${baseFileName}_${timestamp}`;

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(
      buffer,
      publicId,
      "sub-products"
    );

    return NextResponse.json({
      success: true,
      data: uploadResult,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to upload image. Please try again.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

// PUT /api/upload — Replace an existing image by public_id
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const publicId = formData.get("publicId") as string | null; // existing Cloudinary public_id

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    if (!publicId?.trim()) {
      return NextResponse.json(
        { success: false, error: "publicId is required to update an image" },
        { status: 400 }
      );
    }

    // Validate file type — extend to PDF support
    const validTypes = [
      "image/jpeg", "image/jpg", "image/png",
      "image/webp", "image/gif", "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF." },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit for PDFs, 5MB for images)
    const isPdf = file.type === "application/pdf";
    const maxSize = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Max: ${isPdf ? "10MB" : "5MB"}.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Overwrite the existing asset by reusing the same public_id
    const updateResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          public_id: publicId,           // keep the same public_id
          overwrite: true,               // replace in-place
          invalidate: true,              // bust CDN cache immediately
          resource_type: isPdf ? "raw" : "image",
          ...(isPdf
            ? {}
            : { transformation: { quality: "auto:best", fetch_format: "auto" } }),
        },
        (error, result) => {
          if (error) reject(new Error(`Cloudinary update failed: ${error.message}`));
          else if (result)
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              width: result.width ?? 0,
              height: result.height ?? 0,
              format: result.format,
            });
          else reject(new Error("Update failed: No result returned"));
        }
      ).end(buffer);
    });

    return NextResponse.json({ success: true, data: updateResult });
  } catch (error) {
    console.error("Image update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update image.",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/upload — Remove an asset by public_id
export async function DELETE(request: NextRequest) {
  try {
    const { publicId, resourceType = "image" } = await request.json() as {
      publicId: string;
      resourceType?: "image" | "raw" | "video";
    };

    if (!publicId?.trim()) {
      return NextResponse.json(
        { success: false, error: "publicId is required" },
        { status: 400 }
      );
    }

    const deleteResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType, // "raw" for PDFs, "image" for images
      invalidate: true,            // bust CDN cache
    });

    // Cloudinary returns { result: "ok" } on success, "not found" if missing
    if (deleteResult.result === "not found") {
      return NextResponse.json(
        { success: false, error: `Asset not found: ${publicId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { publicId, result: deleteResult.result },
    });
  } catch (error) {
    console.error("Image delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete image.",
      },
      { status: 500 }
    );
  }
}