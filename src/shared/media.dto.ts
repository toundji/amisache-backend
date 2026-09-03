// ============================================================
// UNIFIED AUTH — media.dto.ts
// DTOs de fichiers/médias réutilisables (multipart/form-data via
// nestjs-form-data). Purs — aucune DI, aucune dépendance métier.
// ============================================================
import { ApiProperty } from "@nestjs/swagger";
import { IsFile, MaxFileSize, HasExtension, FileSystemStoredFile, IsFiles, HasMimeType } from "nestjs-form-data";
import { IsOptional, IsUrl } from 'class-validator';

export class FileDocDto {
    @ApiProperty({ required: false, type: "string", format: "binary" })
    @IsFile()
    @HasExtension(["pdf", "doc", "docx"])
    @IsOptional()
    file?: FileSystemStoredFile;
}

export class ImageDto {
    @ApiProperty({ required: false, type: "string", format: "binary" })
    @IsFile()
    @HasExtension(["png", "jpg", "jpeg"])
    image!: FileSystemStoredFile;
}

export class ImageVideoDto {
    @ApiProperty({ required: false, type: "string", format: "binary", description: "require type : image/*, video/* () " })
    @IsFile()
    // @MaxFileSize(20e6)
    @HasExtension(["png", "jpg", "jpeg", "webp", "mp4", "mov", "avi", "mpeg", "mkv"])
    image!: FileSystemStoredFile;
}

export class UrlDto {
    @ApiProperty({ required: false })
    @IsUrl()
    url!: string;
}

export class ImageUrlDto {
    @ApiProperty({ required: false })
    @IsUrl()
    image!: string;
}

export class ImgUrlDto {
    @ApiProperty({ required: false })
    @IsUrl()
    img!: string;
}

export class ImageListDto {
    @ApiProperty({ required: false, type: "string", isArray: true, format: "binary" })
    @IsFiles()
    @MaxFileSize(20e6, { each: true })
    @HasMimeType(['image/jpeg', 'image/png', 'image/jpg'], { each: true })
    images!: FileSystemStoredFile[];
}

export class ImageVideoListDto {
    @ApiProperty({ required: false, type: "string", isArray: true, format: "binary" })
    @IsFiles()
    // @MaxFileSize(20e6, { each: true })
    @HasExtension(["png", "jpg", "jpeg", "webp", "mp4", "mov", "avi", "mpeg", "mkv"], { each: true })
    // @HasMimeType(['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/mov', 'video/mkv', 'video/avi', 'video/mpeg',], { each: true })
    images!: FileSystemStoredFile[];
}

export class DocumentListDto {
    @ApiProperty({ required: false, type: "string", isArray: true, format: "binary" })
    @IsFiles()
    @MaxFileSize(20e6, { each: true })
    @HasExtension(["pdf", "png", "jpg", "jpeg"], { each: true })
    documents!: FileSystemStoredFile[];
}

export class DocDto {
    @ApiProperty({ required: false, type: "string", format: "binary" })
    @IsFile()
    @MaxFileSize(20e6)
    @HasExtension(["pdf", "doc", "docx", "png", "jpg", "jpeg"])
    @IsOptional()
    doc!: FileSystemStoredFile;
}

export class MediaDto {
    @ApiProperty({ required: false, type: "string", format: "binary" })
    @IsFile()
    @IsOptional()
    media?: FileSystemStoredFile;
}

export class MediaListDto {
    @ApiProperty({ required: false, type: "string", isArray: true, format: "binary" })
    @IsFiles()
    // @MaxFileSize(20e6, { each: true })
    @HasExtension(["pdf", "doc", "docx", "png", "jpg", "jpeg", "mp4", "mov", "avi", "mpeg", "mkv"], { each: true })
    medias!: FileSystemStoredFile[];
}

export class AttachmentUploadDto {
    @ApiProperty({ required: true, type: "string", format: "binary" })
    @IsFile()
    @MaxFileSize(20e6)
    @HasExtension([
        "png", "jpg", "jpeg", "webp",
        "mp4", "mov", "avi", "mpeg", "mkv",
        "mp3", "m4a", "wav", "ogg", "webm", "aac",
        "pdf", "doc", "docx",
    ])
    file!: FileSystemStoredFile;
}

export class VideoDto {
    @ApiProperty({ required: false, type: "string", format: "binary" })
    @IsFile()
    @MaxFileSize(20e6)
    @HasExtension(["mp4", "avi"])
    @IsOptional()
    doc?: FileSystemStoredFile;
}
