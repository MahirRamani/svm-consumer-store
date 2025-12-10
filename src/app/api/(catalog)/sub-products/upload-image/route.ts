// app/api/sub-products/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

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
  folder: string = "sub-products"
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