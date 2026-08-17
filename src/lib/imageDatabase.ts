import type { MnemeonaImage } from "@/types/image"

const DATABASE_NAME =
  "mnemeona-images"

const DATABASE_VERSION = 1

const IMAGES_STORE =
  "images"

function openDatabase(): Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      if (
        !("indexedDB" in window)
      ) {
        reject(
          new Error(
            "IndexedDB is not available in this browser.",
          ),
        )

        return
      }

      const request =
        indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION,
        )

      request.onerror = () => {
        reject(
          request.error ??
            new Error(
              "Failed to open Mnemeona image database.",
            ),
        )
      }

      request.onupgradeneeded = () => {
        const database =
          request.result

        if (
          !database.objectStoreNames.contains(
            IMAGES_STORE,
          )
        ) {
          database.createObjectStore(
            IMAGES_STORE,
            {
              keyPath: "id",
            },
          )
        }
      }

      request.onsuccess = () => {
        const database =
          request.result

        database.onversionchange =
          () => {
            database.close()
          }

        resolve(database)
      }
    },
  )
}

function requestToPromise<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise(
    (resolve, reject) => {
      request.onsuccess =
        () => {
          resolve(
            request.result,
          )
        }

      request.onerror = () => {
        reject(
          request.error ??
            new Error(
              "Image database request failed.",
            ),
        )
      }
    },
  )
}

function transactionToPromise(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      transaction.oncomplete =
        () => {
          resolve()
        }

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                "Image database transaction failed.",
              ),
          )
        }

      transaction.onabort = () => {
        reject(
          transaction.error ??
            new Error(
              "Image database transaction was aborted.",
            ),
        )
      }
    },
  )
}

export async function saveImage(
  image: MnemeonaImage,
): Promise<void> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        IMAGES_STORE,
        "readwrite",
      )

    transaction
      .objectStore(
        IMAGES_STORE,
      )
      .put(image)

    await transactionToPromise(
      transaction,
    )
  } finally {
    database.close()
  }
}

export async function getImage(
  imageId: string,
): Promise<MnemeonaImage | null> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        IMAGES_STORE,
        "readonly",
      )

    const request =
      transaction
        .objectStore(
          IMAGES_STORE,
        )
        .get(imageId)

    const result =
      await requestToPromise(
        request,
      )

    return (
      result ??
      null
    )
  } finally {
    database.close()
  }
}

export async function listProjectImages(
  projectId: string,
): Promise<MnemeonaImage[]> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        IMAGES_STORE,
        "readonly",
      )

    const request =
      transaction
        .objectStore(
          IMAGES_STORE,
        )
        .getAll()

    const images =
      await requestToPromise(
        request,
      )

    return (
      images as MnemeonaImage[]
    )
      .filter(
        (image) =>
          image.projectId ===
          projectId,
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt,
          ).getTime() -
          new Date(
            a.createdAt,
          ).getTime(),
      )
  } finally {
    database.close()
  }
}

export async function deleteImage(
  imageId: string,
): Promise<void> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        IMAGES_STORE,
        "readwrite",
      )

    transaction
      .objectStore(
        IMAGES_STORE,
      )
      .delete(imageId)

    await transactionToPromise(
      transaction,
    )
  } finally {
    database.close()
  }
}

export async function deleteProjectImages(
  projectId: string,
): Promise<void> {
  const images =
    await listProjectImages(
      projectId,
    )

  if (!images.length) {
    return
  }

  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        IMAGES_STORE,
        "readwrite",
      )

    const store =
      transaction.objectStore(
        IMAGES_STORE,
      )

    for (const image of images) {
      store.delete(
        image.id,
      )
    }

    await transactionToPromise(
      transaction,
    )
  } finally {
    database.close()
  }
}