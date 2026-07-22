import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

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

type UploadContext = 'product' | 'bill';

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .replace(/-+/g, '_');
}

const CONFIG = {
  product: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024,
    folder: 'sub-products',
    errorMessage: 'Please upload JPEG, PNG or WebP image (max 5MB)',
  },
  bill: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
    maxSize: 10 * 1024 * 1024,
    folder: 'transaction-bills',
    errorMessage: 'Please upload JPEG, PNG, WebP or PDF (max 10MB)',
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const context = formData.get("context") as UploadContext | null;
    const fileName = formData.get("fileName") as string | null;

    if (!context || !CONFIG[context]) {
      return NextResponse.json(
        { success: false, error: "Invalid upload context" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const config = CONFIG[context];
    const isPdf = file.type === "application/pdf"
      || file.name.toLowerCase().endsWith('.pdf');
    const fileType = file.type || (isPdf ? "application/pdf" : "");

    if (!config.allowedTypes.includes(fileType as any)) {
      return NextResponse.json(
        { success: false, error: config.errorMessage },
        { status: 400 }
      );
    }

    if (file.size > config.maxSize) {
      return NextResponse.json(
        { success: false, error: config.errorMessage },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const baseFileName = fileName?.trim()
      ? sanitizeFileName(fileName)
      : sanitizeFileName(file.name.replace(/\.[^/.]+$/, ""));
    const publicId = `${baseFileName}_${Date.now()}`;

    const uploadResult = await new Promise<CloudinaryUploadResult>(
      (resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: config.folder,
            resource_type: "image",
            type: "upload",
            access_mode: "public",

            // Products → convert to WebP
            ...(context === 'product' && {
              transformation: [
                { fetch_format: "webp" },
                { quality: "auto:best" },
              ],
            }),

            // Bill images → good quality
            ...(context === 'bill' && !isPdf && {
              transformation: [
                { fetch_format: "webp" },
                { quality: "auto:best" },
              ],
            }),

            // Bill PDFs → force download
            ...(context === 'bill' && isPdf && {
              format: "pdf",
              flags: "attachment",
            }),
          },
          (error, result) => {
            if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
            else if (result) resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              width: result.width ?? 0,
              height: result.height ?? 0,
              format: result.format,
            });
            else reject(new Error("Upload failed: No result returned"));
          }
        ).end(buffer);
      }
    );

    return NextResponse.json({ success: true, data: uploadResult });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const context = formData.get("context") as UploadContext | null;
    const publicId = formData.get("publicId") as string | null;

    if (!context || !CONFIG[context]) {
      return NextResponse.json(
        { success: false, error: "Invalid upload context" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!publicId?.trim()) {
      return NextResponse.json(
        { success: false, error: "publicId is required to update a file" },
        { status: 400 }
      );
    }

    const config = CONFIG[context];
    const isPdf = file.type === "application/pdf"
      || file.name.toLowerCase().endsWith('.pdf');
    const fileType = file.type || (isPdf ? "application/pdf" : "");

    if (!config.allowedTypes.includes(fileType as any)) {
      return NextResponse.json(
        { success: false, error: config.errorMessage },
        { status: 400 }
      );
    }

    if (file.size > config.maxSize) {
      return NextResponse.json(
        { success: false, error: config.errorMessage },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const updateResult = await new Promise<CloudinaryUploadResult>(
      (resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            resource_type: "image",
            type: "upload",
            access_mode: "public",

            ...(context === 'product' && {
              transformation: [
                { fetch_format: "webp" },
                { quality: "auto:best" },
              ],
            }),

            ...(context === 'bill' && !isPdf && {
              transformation: [
                { fetch_format: "webp" },
                { quality: "auto:best" },
              ],
            }),

            ...(context === 'bill' && isPdf && {
              format: "pdf",
              flags: "attachment",
            }),
          },
          (error, result) => {
            if (error) reject(new Error(`Cloudinary update failed: ${error.message}`));
            else if (result) resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              width: result.width ?? 0,
              height: result.height ?? 0,
              format: result.format,
            });
            else reject(new Error("Update failed: No result returned"));
          }
        ).end(buffer);
      }
    );

    return NextResponse.json({ success: true, data: updateResult });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update file",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { publicId, resourceType = "image" } = await request.json() as {
      publicId: string;
      resourceType?: "image" | "raw";
    };

    if (!publicId?.trim()) {
      return NextResponse.json(
        { success: false, error: "publicId is required" },
        { status: 400 }
      );
    }

    const deleteResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete file",
      },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from 'next/server';
// import { v2 as cloudinary } from 'cloudinary';

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// // ============================================================
// // TYPES
// // ============================================================
// interface CloudinaryUploadResult {
//   secure_url: string;
//   public_id: string;
//   width: number;
//   height: number;
//   format: string;
// }

// type UploadContext = 'product' | 'bill';

// // ============================================================
// // HELPERS
// // ============================================================
// function sanitizeFileName(name: string): string {
//   return name
//     .trim()
//     .replace(/\s+/g, '_')
//     .replace(/[^a-zA-Z0-9\-_.]/g, '')
//     .replace(/-+/g, '_');
// }

// // ============================================================
// // CONFIG
// // ============================================================
// const CONFIG = {
//   product: {
//     allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
//     maxSize: 5 * 1024 * 1024,
//     folder: 'sub-products',
//     errorMessage: 'Please upload JPEG, PNG or WebP image (max 5MB)',
//   },
//   bill: {
//     allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
//     maxSize: 10 * 1024 * 1024,
//     folder: 'transaction-bills',
//     errorMessage: 'Please upload JPEG, PNG, WebP or PDF (max 10MB)',
//   },
// } as const;

// // ============================================================
// // POST — Upload new file
// // ============================================================
// export async function POST(request: NextRequest) {
//   try {
//     const formData = await request.formData();
//     const file = formData.get("file") as File | null;
//     const context = formData.get("context") as UploadContext | null;
//     const fileName = formData.get("fileName") as string | null;

//     if (!context || !CONFIG[context]) {
//       return NextResponse.json(
//         { success: false, error: "Invalid upload context" },
//         { status: 400 }
//       );
//     }

//     if (!file) {
//       return NextResponse.json(
//         { success: false, error: "No file provided" },
//         { status: 400 }
//       );
//     }

//     const config = CONFIG[context];

//     // ✅ Check both MIME type AND extension
//     const isPdf = file.type === "application/pdf"
//       || file.name.toLowerCase().endsWith('.pdf');

//     // ✅ For validation — use file.type if available, else infer from extension
//     const fileType = file.type || (isPdf ? "application/pdf" : "");

//     if (!config.allowedTypes.includes(fileType as any)) {
//       return NextResponse.json(
//         { success: false, error: config.errorMessage },
//         { status: 400 }
//       );
//     }

//     if (file.size > config.maxSize) {
//       return NextResponse.json(
//         { success: false, error: config.errorMessage },
//         { status: 400 }
//       );
//     }

//     const bytes = await file.arrayBuffer();
//     const buffer = Buffer.from(bytes);

//     const baseFileName = fileName?.trim()
//       ? sanitizeFileName(fileName)
//       : sanitizeFileName(file.name.replace(/\.[^/.]+$/, ""));

//     // ✅ Add .pdf extension to publicId for raw PDFs
//     // const publicId = isPdf
//     //   ? `${baseFileName}_${Date.now()}.pdf`
//     //   : `${baseFileName}_${Date.now()}`;
//     const publicId = `${baseFileName}_${Date.now()}`;

//     const uploadResult = await new Promise<CloudinaryUploadResult>(
//       (resolve, reject) => {
//         // cloudinary.uploader.upload_stream(
//         //   {
//         //     public_id: publicId,
//         //     folder: config.folder,

//         //     // ✅ raw for PDFs, image for everything else
//         //     resource_type: isPdf ? "raw" : "image",

//         //     // Products → convert to WebP
//         //     ...(context === 'product' && !isPdf && {
//         //       transformation: [
//         //         { fetch_format: "webp" },
//         //         { quality: "auto:best" },
//         //       ],
//         //     }),

//         //     // Bill images → good quality
//         //     ...(context === 'bill' && !isPdf && {
//         //       transformation: [
//         //         { quality: "auto:best" },
//         //       ],
//         //     }),

//         //     // ✅ No transformation for PDFs — raw stays as-is
//         //   },
//         cloudinary.uploader.upload_stream(
//   {
//     public_id: publicId,
//     folder: config.folder,
//     resource_type: "image", // 👈 image for ALL including PDFs
//     type: "upload",
//     access_mode: "public",

//     // Products → convert to WebP
//     ...(context === 'product' && !isPdf && {
//       transformation: [
//         { fetch_format: "webp" },
//         { quality: "auto:best" },
//       ],
//     }),

//     // Bill images → good quality
//     ...(context === 'bill' && !isPdf && {
//       transformation: [
//         { quality: "auto:best" },
//       ],
//     }),

//     // PDFs → force download when opened
//     ...(isPdf && {
//       format: "pdf",
//       flags: "attachment",
//     }),
//   },
//           (error, result) => {
//             if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
//             else if (result) resolve({
//               secure_url: result.secure_url,
//               public_id: result.public_id,
//               width: result.width ?? 0,
//               height: result.height ?? 0,
//               format: result.format,
//             });
//             else reject(new Error("Upload failed: No result returned"));
//           }
//         ).end(buffer);
//       }
//     );

//     return NextResponse.json({
//       success: true,
//       data: uploadResult,
//     });

//   } catch (error) {
//     return NextResponse.json(
//       {
//         success: false,
//         error: error instanceof Error ? error.message : "Failed to upload file",
//       },
//       { status: 500 }
//     );
//   }
// }

// // ============================================================
// // PUT_ — Replace existing file
// // ============================================================
// export async function PUT_(request: NextRequest) {
//   try {
//     const formData = await request.formData();
//     const file = formData.get("file") as File | null;
//     const context = formData.get("context") as UploadContext | null;
//     const publicId = formData.get("publicId") as string | null;

//     if (!context || !CONFIG[context]) {
//       return NextResponse.json(
//         { success: false, error: "Invalid upload context" },
//         { status: 400 }
//       );
//     }

//     if (!file) {
//       return NextResponse.json(
//         { success: false, error: "No file provided" },
//         { status: 400 }
//       );
//     }

//     if (!publicId?.trim()) {
//       return NextResponse.json(
//         { success: false, error: "publicId is required to update a file" },
//         { status: 400 }
//       );
//     }

//     const config = CONFIG[context];

//     // ✅ Check both MIME type AND extension
//     const isPdf = file.type === "application/pdf"
//       || file.name.toLowerCase().endsWith('.pdf');

//     const fileType = file.type || (isPdf ? "application/pdf" : "");

//     if (!config.allowedTypes.includes(fileType as any)) {
//       return NextResponse.json(
//         { success: false, error: config.errorMessage },
//         { status: 400 }
//       );
//     }

//     if (file.size > config.maxSize) {
//       return NextResponse.json(
//         { success: false, error: config.errorMessage },
//         { status: 400 }
//       );
//     }

//     const bytes = await file.arrayBuffer();
//     const buffer = Buffer.from(bytes);

//     const updateResult = await new Promise<CloudinaryUploadResult>(
//       (resolve, reject) => {
//         cloudinary.uploader.upload_stream(
//           {
//             public_id: publicId,
//             overwrite: true,
//             invalidate: true,

//             // ✅ raw for PDFs, image for everything else
//             resource_type: isPdf ? "raw" : "image",

//             // Products → convert to WebP
//             ...(context === 'product' && !isPdf && {
//               transformation: [
//                 { fetch_format: "webp" },
//                 { quality: "auto:best" },
//               ],
//             }),

//             // Bill images → good quality
//             ...(context === 'bill' && !isPdf && {
//               transformation: [
//                 { quality: "auto:best" },
//               ],
//             }),

//             // ✅ No transformation for PDFs
//           },
//           (error, result) => {
//             if (error) reject(new Error(`Cloudinary update failed: ${error.message}`));
//             else if (result) resolve({
//               secure_url: result.secure_url,
//               public_id: result.public_id,
//               width: result.width ?? 0,
//               height: result.height ?? 0,
//               format: result.format,
//             });
//             else reject(new Error("Update failed: No result returned"));
//           }
//         ).end(buffer);
//       }
//     );

//     return NextResponse.json({ success: true, data: updateResult });

//   } catch (error) {
//     return NextResponse.json(
//       {
//         success: false,
//         error: error instanceof Error ? error.message : "Failed to update file",
//       },
//       { status: 500 }
//     );
//   }
// }

// // ============================================================
// // DELETE — Remove file
// // ============================================================
// export async function DELETE(request: NextRequest) {
//   try {
//     const { publicId, resourceType = "image" } = await request.json() as {
//       publicId: string;
//       resourceType?: "image" | "raw";
//     };

//     if (!publicId?.trim()) {
//       return NextResponse.json(
//         { success: false, error: "publicId is required" },
//         { status: 400 }
//       );
//     }

//     const deleteResult = await cloudinary.uploader.destroy(publicId, {
//       resource_type: resourceType,
//       invalidate: true,
//     });

//     if (deleteResult.result === "not found") {
//       return NextResponse.json(
//         { success: false, error: `Asset not found: ${publicId}` },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       data: { publicId, result: deleteResult.result },
//     });

//   } catch (error) {
//     return NextResponse.json(
//       {
//         success: false,
//         error: error instanceof Error ? error.message : "Failed to delete file",
//       },
//       { status: 500 }
//     );
//   }
// }