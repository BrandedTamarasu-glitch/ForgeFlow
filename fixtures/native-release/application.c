/* Authored Linux lifecycle fixture, MIT license. Not a production storage design. */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#ifndef RELEASE_VERSION
#error RELEASE_VERSION must be defined
#endif

int main(int argc, char **argv) {
    if (argc != 2) { fputs("profile-required\n", stderr); return 2; }
    char state[PATH_MAX], executable[PATH_MAX];
    int length = snprintf(state, sizeof state, "%s/state.txt", argv[1]);
    if (length < 0 || (size_t)length >= sizeof state) return 2;
    ssize_t count = readlink("/proc/self/exe", executable, sizeof executable - 1);
    if (count < 0 || (size_t)count == sizeof executable - 1) { fputs("identity-unavailable\n", stderr); return 3; }
    executable[count] = '\0';

    int schema = 1, launches = 0;
    FILE *input = fopen(state, "r");
    if (input) {
        char extra;
        int fields = fscanf(input, "%9d %9d %c", &schema, &launches, &extra);
        int failed = ferror(input);
        fclose(input);
        if (failed || fields != 2 || schema < 1 || schema > 2 || launches < 0 || launches > 1000000) {
            fputs("invalid-profile\n", stderr); return 4;
        }
        if (schema > RELEASE_VERSION) {
            fputs("unsupported-profile-version\n", stderr); return 5;
        }
    } else if (errno != ENOENT) {
        fputs("profile-read-failed\n", stderr); return 6;
    }

    /* Direct write is sufficient for this serial lifecycle fixture only.
       Crash atomicity, concurrent writes and power-loss durability are unqualified. */
    FILE *output = fopen(state, "w");
    if (!output) { fputs("profile-write-failed\n", stderr); return 7; }
    int written = fprintf(output, "%d %d\n", RELEASE_VERSION, launches + 1);
    int closed = fclose(output);
    if (written < 0 || closed != 0) { fputs("profile-write-failed\n", stderr); return 7; }
    printf("version=%d\nschema=%d\nlaunches=%d\nexecutable=%s\n", RELEASE_VERSION, RELEASE_VERSION, launches + 1, executable);
    return 0;
}
