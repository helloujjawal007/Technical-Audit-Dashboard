import { Share2, ImageOff } from "lucide-react";
import type { SocialPreview } from "@/types";

interface SocialPreviewCardProps {
  preview: SocialPreview;
  url: string;
}

export function SocialPreviewCard({ preview, url }: SocialPreviewCardProps) {
  const title = preview.ogTitle || preview.twitterTitle || "No title";
  const description = preview.ogDescription || preview.twitterDescription || "No description found";
  const image = preview.ogImage || preview.twitterImage;
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch { /* keep */ }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Social Media Preview</h3>
      </div>

      <div className="max-w-md rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        {image ? (
          <div className="aspect-[1.91/1] bg-slate-100 overflow-hidden">
            <img src={image} alt="Social preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        ) : (
          <div className="aspect-[1.91/1] bg-slate-100 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <ImageOff className="w-8 h-8 mx-auto mb-1" />
              <span className="text-xs">No social image</span>
            </div>
          </div>
        )}
        <div className="p-3">
          <p className="text-xs text-slate-400 uppercase truncate">{hostname}</p>
          <p className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{title}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        This is how your page appears when shared on Facebook, LinkedIn, and Twitter.
      </p>
    </div>
  );
}
