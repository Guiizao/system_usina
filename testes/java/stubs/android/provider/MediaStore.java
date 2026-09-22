package android.provider;

import android.net.Uri;

public class MediaStore {
  public static class Files { public static Uri getContentUri(String volume) { return new Uri("content://media/" + volume + "/file"); } }
  public interface MediaColumns { String _ID = "_id"; String RELATIVE_PATH = "relative_path"; String DISPLAY_NAME = "_display_name"; String MIME_TYPE = "mime_type"; }
}
