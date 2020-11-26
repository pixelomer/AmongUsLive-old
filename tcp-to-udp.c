#include <sys/types.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <stdint.h>
#include <pthread.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <stdlib.h>
#include <stdbool.h>

ssize_t my_read(int fd, void *out, size_t length) {
	size_t expected_length = length;
	while (true) {
		ssize_t read_len = read(fd, out, length);
		if (read_len == 0) {
			return 0;
		}
		else if (read_len < 0) {
			return -1;
		}
		else if (read_len >= length) {
			return expected_length;
		}
		length -= read_len;
	}
}

#define read(fd, out, len) my_read(fd, out, len)

int main(int argc, char **argv) {
	// TCP connection
	int tcp_fd = socket(AF_INET, SOCK_STREAM, 0);
	{
		static struct sockaddr_in tcp_address;
		memset(&tcp_address, 0, sizeof(tcp_address));
		tcp_address.sin_family = AF_INET;
		tcp_address.sin_port = htons(25565);
		tcp_address.sin_addr.s_addr = inet_addr("0.0.0.0");
		if (connect(tcp_fd, (struct sockaddr *)&tcp_address, sizeof(tcp_address)) < 0) {
			perror("connect");
			return EXIT_FAILURE;
		}
	}

	// UDP server address
	int udp_fd = socket(AF_INET, SOCK_DGRAM, 0);
	{
		static struct sockaddr_in udp_server;
		memset(&udp_server, 0, sizeof(udp_server));
		udp_server.sin_family = AF_INET;
		udp_server.sin_port = htons(42069);
		udp_server.sin_addr.s_addr = htonl(0);
		bind(udp_fd, (struct sockaddr *)&udp_server, sizeof(udp_server));
	}

	// Get client address
	struct sockaddr_in client_address;
	{
		socklen_t client_address_len = sizeof(client_address);
		char buffer[1024];
		recvfrom(udp_fd, buffer, 1024, MSG_WAITALL, (struct sockaddr *)&client_address, &client_address_len);
	}

	int verbosity = (argc <= 1) ? 0 : (!strncmp(argv[1], "-vv", 3) ? 2 : (!strncmp(argv[1], "-v", 2) ? 1 : 0));
	bool reset_address = false;

	while (true) {
		if (reset_address) {
			while (true) {
				socklen_t client_address_len = sizeof(client_address);
				char buffer[1024];
				recvfrom(udp_fd, buffer, 1024, MSG_WAITALL, (struct sockaddr *)&client_address, &client_address_len);
				if (!reset_address && (buffer[0] == 8)) {
					printf("[PROXY] Received hello packet from library\n");
					break;
				}
				if (buffer[0] == 9) {
					printf("[PROXY] Received disconnect packet from library\n");
					reset_address = false;
					sendto(udp_fd, &buffer[0], 1, 0, (struct sockaddr *)&client_address, sizeof(client_address));
				}
			}
			printf("[PROXY] Did reset address\n");
		}
		unsigned char flags;
		ssize_t read_length;
		if ((read_length = read(tcp_fd, &flags, sizeof(flags))) != sizeof(flags)) {
			printf("Error while reading flags (%zd != %lu)\n", read_length, sizeof(flags));
			break;
		}
		size_t len;
		if ((read_length = read(tcp_fd, &len, sizeof(len))) != sizeof(len)) {
			printf("Error while reading length (%zd != %lu)\n", read_length, sizeof(len));
			break;
		}
		uint8_t *data = malloc(len);
		if ((read_length = read(tcp_fd, data, len)) != len) {
			printf("Error while reading data (%zd != %zu)\n", read_length, len);
			free(data);
			break;
		}
		if (flags & 2) {
			// Debug message
			printf("[TWEAK] ");
			fwrite(data, 1, len, stdout);
			printf("\n");
			if (flags & 4) {
				printf("[PROXY] Will reset address\n");
				reset_address = true;
			}
		}
		else {
			if (verbosity > 0) {
				if ((verbosity > 1) || ((data[0] != 0x0A) && (data[0] != 0x0C))) {
					printf("[%s] ", (flags & 1) ? "Server" : "Client");
					for (size_t i=0; i<len; i++) {
						printf("%02hhX ", data[i]);
					}
					printf("\n");
				}
			}
			bool reliable_exception = (data[0] == 1) && (len >= 6);
			if (reliable_exception) {
				switch (data[5]) {
					case 0x01: // Join game (treated as disconnect packet)
						reliable_exception = false;
				}
			}
			if (
				(flags & 1) ||
				(data[0] == 0) ||
				(data[0] == 4) ||
				reliable_exception ||
				(data[0] == 6)
			) {
				sendto(udp_fd, data, len, 0,
					(struct sockaddr *)&client_address,
					sizeof(client_address)
				);
			}
		}
		free(data);
	}
	printf("Exiting\n");
}