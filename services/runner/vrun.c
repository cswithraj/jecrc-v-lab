/* vrun: exec a command, then report exit status and resource usage.
 * Usage: vrun <statsfile> <cmd> [args...]
 * Writes "exit signal maxrss_kb cpu_ms" to statsfile. */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/resource.h>
int main(int argc, char **argv) {
  if (argc < 3) return 125;
  pid_t pid = fork();
  if (pid < 0) return 125;
  if (pid == 0) { execvp(argv[2], &argv[2]); _exit(127); }
  int status = 0; struct rusage ru;
  if (wait4(pid, &status, 0, &ru) < 0) return 125;
  long cpu = ru.ru_utime.tv_sec * 1000L + ru.ru_utime.tv_usec / 1000 + ru.ru_stime.tv_sec * 1000L + ru.ru_stime.tv_usec / 1000;
  FILE *f = fopen(argv[1], "w");
  if (f) { fprintf(f, "%d %d %ld %ld\n", WIFEXITED(status) ? WEXITSTATUS(status) : -1, WIFSIGNALED(status) ? WTERMSIG(status) : 0, ru.ru_maxrss, cpu); fclose(f); }
  return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}
